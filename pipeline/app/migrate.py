"""Migrate existing flat Parquet outputs to partitioned layout and rebuild STAC.

Run with:  uv run -m app.migrate
"""

import logging
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from . import config
from .load import _TEMPORAL_COLS, _write_partitioned, _write_single
from .stac import build_collection

logger = logging.getLogger(__name__)


def migrate() -> None:
    """Re-layout output/ in-place and rebuild the STAC catalog."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    output_dir = Path(config.OUTPUT_DIR)
    results = []

    for theme_dir in sorted(d for d in output_dir.iterdir() if d.is_dir()):
        theme = theme_dir.name
        for item in sorted(theme_dir.iterdir()):
            if item.is_file() and item.suffix == ".parquet":
                result = _migrate_flat(item, theme, output_dir)
            elif item.is_dir():
                result = _collect_partitioned(item, theme)
            else:
                continue
            if result is not None:
                results.append(result)

    build_collection(results)
    logger.info("\nDone — %d datasets.", len(results))


def _migrate_flat(path: Path, theme: str, output_dir: Path) -> dict:
    """Read a flat .parquet file, write new layout, return a STAC result dict."""
    name = path.stem
    endpoint_id = f"{theme}/{name}"
    logger.info("\n→ %s", endpoint_id)

    table = pq.read_table(path)
    schema = table.schema

    if "admin_level" in schema.names:
        out_dir = path.parent / name
        out_dir.mkdir(exist_ok=True)
        _write_partitioned(table, schema, out_dir)
        path.unlink()
        href = f"{theme}/{name}/"
    else:
        _write_single(table, schema, path)
        href = str(path.relative_to(output_dir))

    t_start, t_end = _temporal(table, schema)
    return {
        "endpoint": {"id": endpoint_id, "theme": theme},
        "path": href,
        "row_count": len(table),
        "schema": schema,
        "start": t_start,
        "end": t_end,
    }


def _collect_partitioned(directory: Path, theme: str) -> dict | None:
    """Collect STAC metadata from an already-partitioned dataset directory."""
    part_files = sorted(directory.rglob("*.parquet"))
    if not part_files:
        return None

    name = directory.name
    endpoint_id = f"{theme}/{name}"
    logger.info("\n→ %s (already partitioned)", endpoint_id)

    schema = pq.read_schema(part_files[0])
    row_count = sum(pq.read_metadata(f).num_rows for f in part_files)

    t_start = t_end = None
    temporal_cols = [c for c in _TEMPORAL_COLS if c in schema.names]
    if temporal_cols:
        combined = pa.concat_tables(
            [pq.read_table(f, columns=temporal_cols) for f in part_files]
        )
        t_start, t_end = _temporal(combined, schema)

    return {
        "endpoint": {"id": endpoint_id, "theme": theme},
        "path": f"{theme}/{name}/",
        "row_count": row_count,
        "schema": schema,
        "start": t_start,
        "end": t_end,
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
