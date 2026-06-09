"""Upload output files to Source Cooperative via obstore."""

import logging
from pathlib import Path

import obstore as obs
from obstore.store import S3Store

from .config import (
    OUTPUT_DIR,
    SOURCE_COOP_BUCKET,
    SOURCE_COOP_PREFIX,
    SOURCE_COOP_REGION,
)

logger = logging.getLogger(__name__)


def sync_output(output_dir: str = OUTPUT_DIR) -> list[str]:
    """Upload all files in output_dir to Source Cooperative; return uploaded paths.

    Credentials are read from the standard AWS environment variables:
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_SESSION_TOKEN.
    Set SOURCE_COOP_PREFIX to "<org>/<product>" before calling.
    """
    store = S3Store(
        bucket=SOURCE_COOP_BUCKET,
        prefix=SOURCE_COOP_PREFIX,
        region=SOURCE_COOP_REGION,
    )
    uploaded: list[str] = []
    for path in sorted(Path(output_dir).rglob("*")):
        if not path.is_file() or path.name.startswith("."):
            continue
        key = str(path.relative_to(output_dir))
        obs.put(store, key, path.read_bytes())
        logger.info("Uploaded %s", key)
        uploaded.append(key)
    return uploaded
