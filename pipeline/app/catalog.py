"""Build catalog.parquet — a queryable index of all extracted datasets."""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

from . import config

logger = logging.getLogger(__name__)


def build_catalog(endpoint_results: list[dict]) -> None:
    """Write catalog.parquet with one row per endpoint."""
    updated_at = datetime.now(UTC).isoformat()
    rows = []
    for r in endpoint_results:
        schema: pa.Schema = r["schema"]
        rows.append(
            {
                "id": r["endpoint"]["id"],
                "theme": r["endpoint"]["theme"],
                "parquet_href": r["path"],
                "row_count": r["row_count"],
                "start_datetime": r["start"],
                "end_datetime": r["end"],
                "columns": json.dumps(
                    [{"name": f.name, "type": str(f.type)} for f in schema]
                ),
                "updated_at": updated_at,
            }
        )

    table = pa.Table.from_pylist(rows)
    out_path = Path(config.OUTPUT_DIR) / "catalog.parquet"
    pq.write_table(table, out_path, compression="zstd", compression_level=15)
    logger.info("\nWrote catalog → %s (%d entries)", out_path, len(rows))
