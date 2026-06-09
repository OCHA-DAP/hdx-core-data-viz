"""Build index.json — a queryable STAC ItemCollection of all extracted datasets."""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

import pystac

if TYPE_CHECKING:
    import pyarrow as pa

from . import config

logger = logging.getLogger(__name__)

_TABLE_EXTENSION = "https://stac-extensions.github.io/table/v1.2.0/schema.json"


def build_catalog(endpoint_results: list[dict]) -> None:
    """Write index.json as a STAC ItemCollection, one Item per endpoint."""
    updated_at = datetime.now(UTC)
    items = []
    for r in endpoint_results:
        schema: pa.Schema = r["schema"]
        base = config.SOURCE_COOP_BASE_URL
        rel_path = r["path"]
        href = f"{base}{rel_path}" if base else rel_path
        start = _parse_dt(r["start"])
        end = _parse_dt(r["end"])
        items.append(
            pystac.Item(
                id=r["endpoint"]["id"],
                geometry=None,
                bbox=None,
                datetime=updated_at if start is None else None,
                start_datetime=start,
                end_datetime=end,
                stac_extensions=[_TABLE_EXTENSION],
                properties={
                    "updated": updated_at.isoformat(),
                    "theme": r["endpoint"]["theme"],
                    "table:row_count": r["row_count"],
                    "table:columns": [
                        {"name": f.name, "type": str(f.type)} for f in schema
                    ],
                },
                assets={
                    "data": pystac.Asset(
                        href=href,
                        media_type="application/vnd.apache.parquet",
                        roles=["data"],
                    )
                },
            )
        )

    out_path = Path(config.OUTPUT_DIR) / "index.json"
    out_path.write_text(json.dumps(pystac.ItemCollection(items).to_dict(), indent=2))
    logger.info("\nWrote index → %s (%d items)", out_path, len(items))


def _parse_dt(value: str | None) -> datetime | None:
    """Parse an ISO datetime string to a timezone-aware datetime, or return None."""
    if value is None:
        return None
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
