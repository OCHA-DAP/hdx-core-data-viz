"""Entry point: extract all configured HAPI endpoints and write Parquet + STAC."""

import logging
import os

import httpx

from .extract import discover_endpoints, fetch_endpoint
from .load import write_parquet
from .stac import build_collection
from .upload import sync_output

logger = logging.getLogger(__name__)


def main() -> None:
    """Fetch all HAPI endpoints, write Parquet files, and build STAC collection."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    results = []
    with httpx.Client(http2=True, timeout=30) as client:
        for endpoint in discover_endpoints(client):
            logger.info("\n→ %s", endpoint["id"])
            pages = fetch_endpoint(client, endpoint["id"])
            path, schema, start, end, row_count = write_parquet(
                endpoint["id"], pages, endpoint["arrow_schema"]
            )
            results.append(
                {
                    "endpoint": endpoint,
                    "path": path,
                    "row_count": row_count,
                    "schema": schema,
                    "start": start,
                    "end": end,
                }
            )

    build_collection(results)

    if os.environ.get("SOURCE_COOP_UPLOAD"):
        sync_output()

    logger.info("\nDone.")


if __name__ == "__main__":
    main()
