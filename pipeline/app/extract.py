"""Fetch paginated records from a HAPI endpoint."""

import logging
from collections.abc import Iterator

import httpx
import pyarrow as pa
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from . import config

logger = logging.getLogger(__name__)


def _is_rate_limited(exc: BaseException) -> bool:
    return (
        isinstance(exc, httpx.HTTPStatusError)
        and exc.response.status_code == httpx.codes.TOO_MANY_REQUESTS
    )


def _log_retry(retry_state: RetryCallState) -> None:
    logger.warning(
        "  429 rate limit; retrying (attempt %d)", retry_state.attempt_number
    )


@retry(
    retry=retry_if_exception(_is_rate_limited),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    stop=stop_after_attempt(10),
    before_sleep=_log_retry,
    reraise=True,
)
def _get_page(client: httpx.Client, url: str, offset: int) -> httpx.Response:
    """GET a single page, raising on any non-2xx including 429."""
    resp = client.get(
        url,
        params={
            "output_format": "json",
            "app_identifier": config.APP_IDENTIFIER,
            "email": config.EMAIL,
            "offset": offset,
        },
    )
    resp.raise_for_status()
    return resp


def _resolve(spec: dict, node: dict) -> dict:
    """Follow $ref chains in an OpenAPI spec node."""
    while "$ref" in node:
        parts = node["$ref"].lstrip("#/").split("/")
        node = spec
        for p in parts:
            node = node[p]
    return node


def _openapi_to_arrow(spec: dict, prop: dict) -> pa.DataType:
    """Map an OpenAPI property schema to a PyArrow type."""
    prop = _resolve(spec, prop)
    if "anyOf" in prop:
        non_null = [s for s in prop["anyOf"] if s.get("type") != "null"]
        return _openapi_to_arrow(spec, non_null[0]) if non_null else pa.null()
    t = prop.get("type", "string")
    if t == "integer":
        return pa.int64()
    if t == "number":
        return pa.float64()
    if t == "boolean":
        return pa.bool_()
    return pa.string()


def _endpoint_schema(spec: dict, path: str) -> pa.Schema | None:
    """Extract a PyArrow schema from the OpenAPI response schema for a path."""
    try:
        op = spec["paths"][path]["get"]
        raw = op["responses"]["200"]["content"]["application/json"]["schema"]
        resp = _resolve(spec, raw)
        items = _resolve(spec, resp["properties"]["data"]["items"])
        return pa.schema(
            [
                pa.field(name, _openapi_to_arrow(spec, prop))
                for name, prop in items.get("properties", {}).items()
            ]
        )
    except (KeyError, TypeError):
        return None


def discover_endpoints(client: httpx.Client) -> list[dict]:
    """Return all data endpoints from the HAPI OpenAPI spec."""
    resp = client.get(config.OPENAPI_URL)
    resp.raise_for_status()
    spec = resp.json()

    endpoints = []
    for path, methods in spec.get("paths", {}).items():
        op = methods.get("get", {})
        tags = set(op.get("tags", []))
        if tags & config.UTILITY_TAGS:
            continue
        parts = path.split("/")
        endpoint_id = "/".join(parts[3:])
        endpoints.append(
            {
                "id": endpoint_id,
                "theme": parts[3],
                "arrow_schema": _endpoint_schema(spec, path),
            }
        )

    return endpoints


def fetch_endpoint(client: httpx.Client, endpoint_id: str) -> Iterator[list[dict]]:
    """Yield pages of records from a HAPI endpoint."""
    offset = 0
    url = f"{config.BASE_URL}/{endpoint_id}"

    while True:
        resp = _get_page(client, url, offset)
        page = resp.json().get("data", [])
        if not page:
            break
        logger.info("  %s: offset=%d, got %d records", endpoint_id, offset, len(page))
        yield page
        offset += len(page)
