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
        rel_path = r["path"]
        base = config.SOURCE_COOP_BASE_URL
        href = f"{base}{rel_path}" if base else rel_path
        entries.append(
            {
                "id": r["endpoint"]["id"],
                "theme": r["endpoint"]["theme"],
                "href": href,
                "table:row_count": r["row_count"],
                "start_datetime": r["start"],
                "end_datetime": r["end"],
                "table:columns": [
                    {"name": f.name, "type": str(f.type)} for f in schema
                ],
                "updated": updated_at,
            }
        )

    out_path = Path(config.OUTPUT_DIR) / "index.json"
    out_path.write_text(json.dumps(entries, indent=2))
    logger.info("\nWrote index → %s (%d entries)", out_path, len(entries))
