"""Sync output files to Source Cooperative via obstore."""

import hashlib
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


def _etag_matches(path: Path, remote_etag: str) -> bool:
    """Return True if the local file's MD5 matches a single-part S3 ETag."""
    etag = remote_etag.strip('"')
    if "-" in etag:
        # Multi-part upload ETag — can't compare with local MD5, treat as changed.
        return False
    h = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest() == etag


def sync_output(output_dir: str = OUTPUT_DIR) -> None:
    """Sync output_dir to Source Cooperative: upload new/changed files, delete removed.

    Skips files whose size and ETag (MD5) match the remote copy.
    Credentials are read from the standard AWS environment variables:
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_SESSION_TOKEN.
    Set SOURCE_COOP_PREFIX to "<org>/<product>" before calling.
    """
    if not SOURCE_COOP_BUCKET or not SOURCE_COOP_PREFIX:
        msg = 'SOURCE_COOP_PREFIX must be "<org>/<product>", e.g. hdx/hapi'
        raise ValueError(msg)

    local: dict[str, Path] = {
        str(p.relative_to(output_dir)): p
        for p in Path(output_dir).rglob("*")
        if p.is_file() and not p.name.startswith(".")
    }
    if "collection.json" not in local:
        msg = f"No collection.json in {Path(output_dir).resolve()}; refusing to sync"
        raise RuntimeError(msg)

    store = S3Store(
        bucket=SOURCE_COOP_BUCKET,
        prefix=SOURCE_COOP_PREFIX,
        region=SOURCE_COOP_REGION,
    )

    remote: dict[str, tuple[int, str | None]] = {
        item["path"]: (item["size"], item["e_tag"])
        for page in obs.list(store)
        for item in page
    }

    uploaded = skipped = 0
    for key, path in sorted(local.items()):
        if key in remote:
            remote_size, remote_etag = remote[key]
            if (
                path.stat().st_size == remote_size
                and remote_etag
                and _etag_matches(path, remote_etag)
            ):
                skipped += 1
                continue
        obs.put(store, key, path.read_bytes())
        uploaded += 1
        logger.info("Uploaded %s", key)

    for key in sorted(set(remote) - set(local)):
        obs.delete(store, key)
        logger.info("Deleted  %s", key)

    logger.info("Sync complete: %d uploaded, %d skipped unchanged.", uploaded, skipped)
