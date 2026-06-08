"""Write endpoint records to a Parquet file."""

import logging
from collections.abc import Iterator
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from . import config

logger = logging.getLogger(__name__)

_TEMPORAL_COLS = ("reference_period_start", "reference_period_end")


def write_parquet(
    endpoint_id: str,
    pages: Iterator[list[dict]],
    schema: pa.Schema | None = None,
) -> tuple[str, pa.Schema, str | None, str | None, int]:
    """Stream pages to Parquet; return (path, schema, start, end, row_count)."""
    theme, name = endpoint_id.split("/", 1)
    out_path = Path(config.OUTPUT_DIR) / theme / f"{name}.parquet"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    start_col, end_col = _TEMPORAL_COLS
    t_start: str | None = None
    t_end: str | None = None
    row_count = 0
    writer: pq.ParquetWriter | None = None
    has_start = has_end = False

    for page in pages:
        table = pa.Table.from_pylist(page, schema=schema)

        if writer is None:
            if schema is None:
                schema = table.schema
            has_start = start_col in schema.names
            has_end = end_col in schema.names
            writer = pq.ParquetWriter(
                out_path, schema, compression="zstd", compression_level=15
            )

        writer.write_table(table)
        row_count += len(page)

        if has_start:
            v = str(pc.min(table.column(start_col)).as_py())
            t_start = v if t_start is None else min(t_start, v)
        if has_end:
            v = str(pc.max(table.column(end_col)).as_py())
            t_end = v if t_end is None else max(t_end, v)

    if writer:
        writer.close()

    href = str(out_path.relative_to(config.OUTPUT_DIR))
    logger.info("  Wrote %s rows → %s", f"{row_count:,}", out_path)
    return href, schema, t_start, t_end, row_count
