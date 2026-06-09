"""Write a STAC Collection and per-Item JSON files for all extracted datasets."""

import json
import logging
from collections import defaultdict
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
    "which provides standardized humanitarian indicators designed for seamless "
    "interoperability from multiple sources. Covers affected people, food "
    "security, funding, conflict, operational presence, and more. "
    "Individual dataset licenses vary — see source links."
)
_KEYWORDS = ["humanitarian", "hapi", "hdx", "hxl", "ocha", "parquet", "cloud-native"]
_PROVIDERS = [
    pystac.Provider(
        name="UN OCHA HDX Humanitarian API",
        description=(
            "The HDX Humanitarian API (HAPI) provides standardized humanitarian "
            "indicators from multiple sources to facilitate automated workflows "
            "and visualizations supporting humanitarian decision-making."
        ),
        roles=["producer", "processor"],
        url="https://hapi.humdata.org/",
    )
]
_THEME_TITLES = {
    "affected-people": "Affected People",
    "climate": "Climate",
    "coordination-context": "Coordination Context",
    "food-security-nutrition-poverty": "Food Security, Nutrition & Poverty",
    "geography-infrastructure": "Geography & Infrastructure",
    "metadata": "Metadata",
}
_ITEM_ASSETS = {
    "data": {
        "type": _MT.VND_APACHE_PARQUET,
        "roles": ["data"],
        "title": "Parquet data file",
    }
}


def build_collection(endpoint_results: list[dict]) -> None:
    """Write collection.json and per-Item JSON files to the output directory."""
    output_dir = Path(config.OUTPUT_DIR)
    base = config.SOURCE_COOP_BASE_URL
    updated_at = datetime.now(UTC)

    items = [_build_item(r, base, updated_at) for r in endpoint_results]

    for item in items:
        item_path = output_dir / f"{item.id}.json"
        item_path.write_text(json.dumps(item.to_dict(), indent=2))
        logger.info("Wrote item       → %s", item_path)

    theme_results: dict[str, list[dict]] = defaultdict(list)
    theme_items: dict[str, list[pystac.Item]] = defaultdict(list)
    for r, item in zip(endpoint_results, items, strict=True):
        theme = r["endpoint"]["theme"]
        theme_results[theme].append(r)
        theme_items[theme].append(item)

    for theme, t_results in sorted(theme_results.items()):
        child = _build_child_collection(
            theme, t_results, theme_items[theme], base, updated_at
        )
        child_path = output_dir / theme / "collection.json"
        child_path.write_text(json.dumps(child.to_dict(), indent=2))
        logger.info("Wrote child coll → %s", child_path)

    collection = _build_collection(
        endpoint_results, sorted(theme_results.keys()), base, updated_at
    )
    collection_path = output_dir / "collection.json"
    collection_path.write_text(json.dumps(collection.to_dict(), indent=2))
    logger.info(
        "\nWrote collection → %s (%d themes)", collection_path, len(theme_results)
    )


def _child_collection_id(theme: str) -> str:
    """Return the STAC Collection ID for a theme sub-collection."""
    return f"{_COLLECTION_ID}-{theme}"


def _build_item(r: dict, base: str, updated_at: datetime) -> pystac.Item:
    """Build a single STAC Item from an endpoint result."""
    schema: pa.Schema = r["schema"]
    item_id: str = r["endpoint"]["id"]
    theme: str = r["endpoint"]["theme"]
    parquet_href = f"{base}{r['path']}" if base else r["path"]
    start = _parse_dt(r["start"])
    end = _parse_dt(r["end"])
    has_interval = start is not None and end is not None

    item = pystac.Item(
        id=item_id,
        geometry=None,
        bbox=None,
        datetime=None if has_interval else updated_at,
        start_datetime=start if has_interval else None,
        end_datetime=end if has_interval else None,
        collection=_child_collection_id(theme),
        properties={
            "updated": updated_at.isoformat(),
            "theme": theme,
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
    root_href = f"{base}collection.json" if base else f"{rel_root}collection.json"
    child_col_href = f"{base}{theme}/collection.json" if base else "collection.json"

    item.add_link(pystac.Link(pystac.RelType.SELF, self_href, media_type=_MT.GEOJSON))
    item.add_link(pystac.Link(pystac.RelType.ROOT, root_href, media_type=_MT.JSON))
    item.add_link(
        pystac.Link(pystac.RelType.COLLECTION, child_col_href, media_type=_MT.JSON)
    )

    return item


def _build_child_collection(
    theme: str,
    endpoint_results: list[dict],
    items: list[pystac.Item],
    base: str,
    updated_at: datetime,
) -> pystac.Collection:
    """Build a theme-level child STAC Collection."""
    starts = [_parse_dt(r["start"]) for r in endpoint_results if r["start"]]
    ends = [_parse_dt(r["end"]) for r in endpoint_results if r["end"]]
    title = _THEME_TITLES.get(theme, theme.replace("-", " ").title())

    child = pystac.Collection(
        id=_child_collection_id(theme),
        title=title,
        description=f"HDX HAPI {title} datasets — cloud-native Parquet exports.",
        extent=pystac.Extent(
            spatial=pystac.SpatialExtent(bboxes=[[-180, -90, 180, 90]]),
            temporal=pystac.TemporalExtent(
                intervals=[[min(starts, default=None), max(ends, default=None)]]
            ),
        ),
        license="CC-BY-4.0",
        stac_extensions=[te.SCHEMA_URI],
        extra_fields={
            "updated": updated_at.isoformat(),
            "item_assets": _ITEM_ASSETS,
        },
    )

    self_href = f"{base}{theme}/collection.json" if base else f"{theme}/collection.json"
    root_href = f"{base}collection.json" if base else "../collection.json"

    child.add_link(pystac.Link(pystac.RelType.SELF, self_href, media_type=_MT.JSON))
    child.add_link(pystac.Link(pystac.RelType.ROOT, root_href, media_type=_MT.JSON))
    child.add_link(pystac.Link(pystac.RelType.PARENT, root_href, media_type=_MT.JSON))

    for item in items:
        item_name = item.id.split("/", 1)[1]
        item_href = f"{base}{item.id}.json" if base else f"{item_name}.json"
        child.add_link(
            pystac.Link(pystac.RelType.ITEM, item_href, media_type=_MT.GEOJSON)
        )

    return child


def _build_collection(
    endpoint_results: list[dict],
    themes: list[str],
    base: str,
    updated_at: datetime,
) -> pystac.Collection:
    """Build the root STAC Collection object."""
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
        license="CC-BY-4.0",
        keywords=_KEYWORDS,
        providers=_PROVIDERS,
        stac_extensions=[te.SCHEMA_URI],
        extra_fields={
            "updated": updated_at.isoformat(),
            "item_assets": _ITEM_ASSETS,
        },
    )

    self_href = f"{base}collection.json" if base else "collection.json"
    collection.add_link(
        pystac.Link(pystac.RelType.SELF, self_href, media_type=_MT.JSON)
    )
    collection.add_link(
        pystac.Link(
            "license",
            "https://data.humdata.org/hapi",
            media_type=_MT.HTML,
            title="HDX HAPI — per-dataset license information",
        )
    )
    collection.add_link(
        pystac.Link(
            "via",
            "https://hapi.humdata.org/",
            media_type=_MT.HTML,
            title="HDX Humanitarian API",
        )
    )
    collection.add_link(
        pystac.Link(
            "describedby",
            "https://hdx-hapi.readthedocs.io/en/latest/",
            media_type=_MT.HTML,
            title="HDX HAPI documentation",
        )
    )

    for theme in themes:
        child_href = (
            f"{base}{theme}/collection.json" if base else f"{theme}/collection.json"
        )
        title = _THEME_TITLES.get(theme, theme.replace("-", " ").title())
        collection.add_link(
            pystac.Link(
                pystac.RelType.CHILD, child_href, media_type=_MT.JSON, title=title
            )
        )

    return collection


def _parse_dt(value: str | None) -> datetime | None:
    """Parse an ISO datetime string to a timezone-aware datetime, or return None."""
    if value is None:
        return None
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
