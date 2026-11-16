"""Migrate existing Parquet outputs to current layout and rebuild STAC.

Run with:  uv run -m pipeline.migrate
"""

import logging
import shutil
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from . import config
from .load import _TEMPORAL_COLS, _row_group_size, _write_partitioned, _write_single
from .stac import build_collection

logger = logging.getLogger(__name__)


def migrate() -> None:
    """Re-layout catalog/ in-place and rebuild the STAC catalog."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    output_dir = Path(config.OUTPUT_DIR)
    results = []

    for theme_dir in sorted(d for d in output_dir.iterdir() if d.is_dir()):
        theme = theme_dir.name
        for item in sorted(theme_dir.iterdir()):
            if item.is_file() and item.suffix == ".parquet":
                result = _migrate_flat(item, theme, output_dir)
            elif item.is_dir():
                result = _migrate_partitioned(item, theme)
            else:
                continue
            if result is not None:
                results.append(result)

    build_collection(results)
    logger.info("\nDone — %d datasets.", len(results))


def _migrate_flat(path: Path, theme: str, output_dir: Path) -> dict:
    """Read a flat .parquet file, write current layout, return a STAC result dict."""
    name = path.stem
    endpoint_id = f"{theme}/{name}"
    logger.info("\n→ %s", endpoint_id)

    table = pq.read_table(path)
    schema = table.schema
    rg_size = _row_group_size(table)

    if "admin_level" in schema.names:
        out_dir = path.parent / name
        out_dir.mkdir(exist_ok=True)
        _write_partitioned(table, schema, out_dir, rg_size)
        path.unlink()
        href = f"{theme}/{name}/"
        partition_keys: list[str] | None = ["admin_level"]
    else:
        _write_single(table, schema, path, rg_size)
        href = str(path.relative_to(output_dir))
        partition_keys = None

    t_start, t_end = _temporal(table, schema)
    return {
        "endpoint": {"id": endpoint_id, "theme": theme},
        "path": href,
        "row_count": len(table),
        "schema": schema,
        "start": t_start,
        "end": t_end,
        "partition_keys": partition_keys,
    }


def _migrate_partitioned(directory: Path, theme: str) -> dict | None:
    """Consolidate a partitioned dataset to admin_level-only layout.

    Reads all Parquet files under the directory (including any location_code=*
    sub-partitions from the old layout), rewrites as admin_level=N/part-0.parquet,
    then removes stale subdirectories.
    """
    part_files = sorted(directory.rglob("*.parquet"))
    if not part_files:
        return None

    name = directory.name
    endpoint_id = f"{theme}/{name}"
    logger.info("\n→ %s", endpoint_id)

    table = pa.concat_tables([pq.ParquetFile(f).read() for f in part_files])
    schema = table.schema
    rg_size = _row_group_size(table)

    _write_partitioned(table, schema, directory, rg_size)

    # Remove stale location_code=* subdirectories left from old layout
    for level_dir in directory.iterdir():
        if level_dir.is_dir() and level_dir.name.startswith("admin_level="):
            for child in level_dir.iterdir():
                if child.is_dir() and child.name.startswith("location_code="):
                    shutil.rmtree(child)

    t_start, t_end = _temporal(table, schema)
    return {
        "endpoint": {"id": endpoint_id, "theme": theme},
        "path": f"{theme}/{name}/",
        "row_count": len(table),
        "schema": schema,
        "start": t_start,
        "end": t_end,
        "partition_keys": ["admin_level"],
    }


def _temporal(table: pa.Table, schema: pa.Schema) -> tuple[str | None, str | None]:
    """Return (min start, max end) from temporal columns, or (None, None)."""
    start_col, end_col = _TEMPORAL_COLS

    def _scalar(col: str, agg: str) -> str | None:
        fn = pc.min if agg == "min" else pc.max
        val = fn(table.column(col)).as_py()
        return str(val) if val is not None else None

    t_start = _scalar(start_col, "min") if start_col in schema.names else None
    t_end = _scalar(end_col, "max") if end_col in schema.names else None
    return t_start, t_end


if __name__ == "__main__":
    migrate()
