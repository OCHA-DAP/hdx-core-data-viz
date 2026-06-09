"""Sync output files to Source Cooperative via obstore."""

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


def sync_output(output_dir: str = OUTPUT_DIR) -> None:
    """Sync output_dir to Source Cooperative: upload new/changed files, delete removed.

    Credentials are read from the standard AWS environment variables:
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_SESSION_TOKEN.
    Set SOURCE_COOP_PREFIX to "<org>/<product>" before calling.
    """
    store = S3Store(
        bucket=SOURCE_COOP_BUCKET,
        prefix=SOURCE_COOP_PREFIX,
        region=SOURCE_COOP_REGION,
    )

    local_keys = {
        str(p.relative_to(output_dir))
        for p in Path(output_dir).rglob("*")
        if p.is_file() and not p.name.startswith(".")
    }

    remote_keys = {item["path"] for page in obs.list(store) for item in page}

    to_delete = remote_keys - local_keys
    for key in sorted(to_delete):
        obs.delete(store, key)
        logger.info("Deleted  %s", key)

    for key in sorted(local_keys):
        obs.put(store, key, Path(output_dir, key).read_bytes())
        logger.info("Uploaded %s", key)
