"""Write a STAC Collection and per-Item JSON files for all extracted datasets."""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING

import pystac
import pystac.extensions.table as te

if TYPE_CHECKING:
    import pyarrow as pa

from . import config

logger = logging.getLogger(__name__)

_MT = pystac.MediaType
_COLLECTION_ID = "hdx-hapi"
_COLLECTION_TITLE = "HDX HAPI Cloud-Native"
_COLLECTION_DESCRIPTION = (
    "Cloud-native Parquet exports of the UN OCHA Humanitarian API (HAPI), "
    "covering humanitarian indicators across affected people, food security, "
    "funding, conflict, and more."
)


def build_collection(endpoint_results: list[dict]) -> None:
    """Write collection.json and per-Item JSON files to the output directory."""
    output_dir = Path(config.OUTPUT_DIR)
    base = config.SOURCE_COOP_BASE_URL
    updated_at = datetime.now(UTC)

    items = [_build_item(r, base, updated_at) for r in endpoint_results]
    collection = _build_collection(endpoint_results, items, base, updated_at)

    for item in items:
        item_path = output_dir / f"{item.id}.json"
        item_path.write_text(json.dumps(item.to_dict(), indent=2))
        logger.info("Wrote item       → %s", item_path)

    collection_path = output_dir / "collection.json"
    collection_path.write_text(json.dumps(collection.to_dict(), indent=2))
    logger.info("\nWrote collection → %s (%d items)", collection_path, len(items))


def _build_item(r: dict, base: str, updated_at: datetime) -> pystac.Item:
    """Build a single STAC Item from an endpoint result."""
    schema: pa.Schema = r["schema"]
    item_id: str = r["endpoint"]["id"]
    parquet_href = f"{base}{r['path']}" if base else r["path"]
    start = _parse_dt(r["start"])
    end = _parse_dt(r["end"])

    item = pystac.Item(
        id=item_id,
        geometry=None,
        bbox=None,
        datetime=updated_at if start is None else None,
        start_datetime=start,
        end_datetime=end,
        collection=_COLLECTION_ID,
        properties={
            "updated": updated_at.isoformat(),
            "theme": r["endpoint"]["theme"],
        },
        assets={
            "data": pystac.Asset(
                href=parquet_href,
                media_type=_MT.VND_APACHE_PARQUET,
                roles=["data"],
            )
        },
    )

    table_ext = te.TableExtension.ext(item, add_if_missing=True)
    table_ext.row_count = r["row_count"]
    table_ext.columns = [
        te.Column({"name": f.name, "type": str(f.type)}) for f in schema
    ]

    depth = item_id.count("/")
    rel_root = "../" * depth or "./"
    self_href = f"{base}{item_id}.json" if base else f"{item_id}.json"
    col_href = f"{base}collection.json" if base else f"{rel_root}collection.json"

    item.add_link(pystac.Link(pystac.RelType.SELF, self_href, media_type=_MT.GEOJSON))
    item.add_link(pystac.Link(pystac.RelType.COLLECTION, col_href, media_type=_MT.JSON))

    return item


def _build_collection(
    endpoint_results: list[dict],
    items: list[pystac.Item],
    base: str,
    updated_at: datetime,
) -> pystac.Collection:
    """Build the STAC Collection object."""
    starts = [_parse_dt(r["start"]) for r in endpoint_results if r["start"]]
    ends = [_parse_dt(r["end"]) for r in endpoint_results if r["end"]]

    collection = pystac.Collection(
        id=_COLLECTION_ID,
        title=_COLLECTION_TITLE,
        description=_COLLECTION_DESCRIPTION,
        extent=pystac.Extent(
            spatial=pystac.SpatialExtent(bboxes=[[-180, -90, 180, 90]]),
            temporal=pystac.TemporalExtent(
                intervals=[[min(starts, default=None), max(ends, default=None)]]
            ),
        ),
        license="other",
        stac_extensions=[te.SCHEMA_URI],
        extra_fields={
            "updated": updated_at.isoformat(),
            "item_assets": {
                "data": {
                    "type": _MT.VND_APACHE_PARQUET,
                    "roles": ["data"],
                    "title": "Parquet data file",
                }
            },
        },
    )

    self_href = f"{base}collection.json" if base else "collection.json"
    collection.add_link(
        pystac.Link(pystac.RelType.SELF, self_href, media_type=_MT.JSON)
    )

    for item in items:
        item_href = f"{base}{item.id}.json" if base else f"{item.id}.json"
        collection.add_link(
            pystac.Link(pystac.RelType.ITEM, item_href, media_type=_MT.GEOJSON)
        )

    return collection


def _parse_dt(value: str | None) -> datetime | None:
    """Parse an ISO datetime string to a timezone-aware datetime, or return None."""
    if value is None:
        return None
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
