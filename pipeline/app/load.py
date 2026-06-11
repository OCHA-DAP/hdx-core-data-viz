"""Write endpoint records to Parquet, partitioned and sorted for DuckDB-WASM."""

import logging
from collections.abc import Iterator
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from . import config

logger = logging.getLogger(__name__)

_TEMPORAL_COLS = ("reference_period_start", "reference_period_end")
_ROW_GROUP_SIZE = 131_072  # 128 K rows — optimal for DuckDB-WASM HTTP range requests

# Compound sort key per admin level; each level extends the geographic hierarchy.
_LEVEL_SORT_KEYS: dict[int, list[str]] = {
    0: ["location_code"],
    1: ["location_code", "admin1_code"],
    2: ["location_code", "admin1_code", "admin2_code"],
}


def write_parquet(
    endpoint_id: str,
    pages: Iterator[list[dict]],
    schema: pa.Schema | None = None,
) -> tuple[str, pa.Schema, str | None, str | None, int]:
    """Buffer pages, sort, and write Parquet.

    Returns (href, schema, start, end, row_count).

    Datasets with an ``admin_level`` column are written as Hive-partitioned
    directories (``<theme>/<name>/admin_level=N/part-0.parquet``) sorted by the
    geographic hierarchy within each partition.  All other datasets are written
    as a single file sorted by ``location_code`` when that column is present.
    """
    theme, name = endpoint_id.split("/", 1)
    start_col, end_col = _TEMPORAL_COLS

    tables: list[pa.Table] = []
    for page in pages:
        table = pa.Table.from_pylist(page, schema=schema)
        if schema is None:
            schema = table.schema
        tables.append(table)

    if not tables or schema is None:
        return f"{theme}/{name}.parquet", schema or pa.schema([]), None, None, 0

    full = pa.concat_tables(tables)
    row_count = len(full)

    def _as_str(val: object) -> str | None:
        v = val.as_py() if hasattr(val, "as_py") else val
        return str(v) if v is not None else None

    t_start = (
        _as_str(pc.min(full.column(start_col))) if start_col in schema.names else None
    )
    t_end = _as_str(pc.max(full.column(end_col))) if end_col in schema.names else None

    out_base = Path(config.OUTPUT_DIR) / theme
    out_base.mkdir(parents=True, exist_ok=True)

    if "admin_level" in schema.names:
        out_dir = out_base / name
        stale = out_dir.with_suffix(".parquet")
        if stale.exists():
            stale.unlink()
        out_dir.mkdir(exist_ok=True)
        _write_partitioned(full, schema, out_dir)
        href = f"{theme}/{name}/"
        logger.info("  Wrote %s rows → %s/", f"{row_count:,}", out_dir)
    else:
        out_path = out_base / f"{name}.parquet"
        _write_single(full, schema, out_path)
        href = str(out_path.relative_to(config.OUTPUT_DIR))
        logger.info("  Wrote %s rows → %s", f"{row_count:,}", out_path)

    return href, schema, t_start, t_end, row_count


def _write_partitioned(table: pa.Table, schema: pa.Schema, out_dir: Path) -> None:
    """Write Hive-partitioned Parquet files under out_dir.

    Admin level 0: ``admin_level=0/part-0.parquet``
    Admin levels 1-2: ``admin_level=N/location_code=XXX/part-0.parquet``
    """
    for level in sorted(pc.unique(table.column("admin_level")).to_pylist()):
        if level is None:
            continue
        level_subset = table.filter(pc.equal(table.column("admin_level"), level))
        sort_keys = [
            k
            for k in _LEVEL_SORT_KEYS.get(level, ["location_code"])
            if k in schema.names
        ]
        part_dir = out_dir / f"admin_level={level}"
        part_dir.mkdir(exist_ok=True)

        if level >= 1 and "location_code" in schema.names:
            for code in sorted(
                pc.unique(level_subset.column("location_code")).to_pylist()
            ):
                if code is None:
                    continue
                loc_subset = level_subset.filter(
                    pc.equal(level_subset.column("location_code"), code)
                )
                if sort_keys:
                    loc_subset = loc_subset.sort_by(
                        [(c, "ascending") for c in sort_keys]
                    )
                loc_dir = part_dir / f"location_code={code}"
                loc_dir.mkdir(exist_ok=True)
                pq.write_table(
                    loc_subset,
                    loc_dir / "part-0.parquet",
                    compression="zstd",
                    compression_level=15,
                    row_group_size=_ROW_GROUP_SIZE,
                )
        else:
            if sort_keys:
                level_subset = level_subset.sort_by(
                    [(c, "ascending") for c in sort_keys]
                )
            pq.write_table(
                level_subset,
                part_dir / "part-0.parquet",
                compression="zstd",
                compression_level=15,
                row_group_size=_ROW_GROUP_SIZE,
            )


def _write_single(table: pa.Table, schema: pa.Schema, out_path: Path) -> None:
    """Write a single Parquet file, sorted by location_code when available."""
    if "location_code" in schema.names:
        table = table.sort_by("location_code")
    pq.write_table(
        table,
        out_path,
        compression="zstd",
        compression_level=15,
        row_group_size=_ROW_GROUP_SIZE,
    )
