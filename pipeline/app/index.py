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


_STAC_VERSION = "1.0.0"
_TABLE_EXTENSION = "https://stac-extensions.github.io/table/v1.2.0/schema.json"


def build_catalog(endpoint_results: list[dict]) -> None:
    """Write index.json as a STAC ItemCollection, one Item per endpoint."""
    updated_at = datetime.now(UTC).isoformat()
    features = []
    for r in endpoint_results:
        schema: pa.Schema = r["schema"]
        rel_path = r["path"]
        base = config.SOURCE_COOP_BASE_URL
        href = f"{base}{rel_path}" if base else rel_path
        features.append(
            {
                "type": "Feature",
                "stac_version": _STAC_VERSION,
                "stac_extensions": [_TABLE_EXTENSION],
                "id": r["endpoint"]["id"],
                "geometry": None,
                "links": [],
                "assets": {
                    "data": {
                        "href": href,
                        "type": "application/vnd.apache.parquet",
                        "roles": ["data"],
                    }
                },
                "properties": {
                    "datetime": None,
                    "start_datetime": r["start"],
                    "end_datetime": r["end"],
                    "updated": updated_at,
                    "theme": r["endpoint"]["theme"],
                    "table:row_count": r["row_count"],
                    "table:columns": [
                        {"name": f.name, "type": str(f.type)} for f in schema
                    ],
                },
            }
        )

    collection = {"type": "FeatureCollection", "features": features}
    out_path = Path(config.OUTPUT_DIR) / "index.json"
    out_path.write_text(json.dumps(collection, indent=2))
    logger.info("\nWrote index → %s (%d items)", out_path, len(features))
