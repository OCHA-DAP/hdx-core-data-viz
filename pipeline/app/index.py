"""Build index.json — a queryable index of all extracted datasets."""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pyarrow as pa

from . import config

logger = logging.getLogger(__name__)


def build_catalog(endpoint_results: list[dict]) -> None:
    """Write index.json with one entry per endpoint."""
    updated_at = datetime.now(UTC).isoformat()
    entries = []
    for r in endpoint_results:
        schema: pa.Schema = r["schema"]
        entries.append(
            {
                "id": r["endpoint"]["id"],
                "theme": r["endpoint"]["theme"],
                "parquet_href": r["path"],
                "row_count": r["row_count"],
                "start_datetime": r["start"],
                "end_datetime": r["end"],
                "columns": [{"name": f.name, "type": str(f.type)} for f in schema],
                "updated_at": updated_at,
            }
        )

    out_path = Path(config.OUTPUT_DIR) / "index.json"
    out_path.write_text(json.dumps(entries, indent=2))
    logger.info("\nWrote index → %s (%d entries)", out_path, len(entries))
