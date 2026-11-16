"""Configuration: credentials, API settings, and endpoint registry."""

import base64
import os

from dotenv import load_dotenv

load_dotenv()

EMAIL: str = os.environ.get("EMAIL", "user@example.com")
APP_NAME: str = os.environ.get("APP_NAME", "hdx-hapi-cloud-native")

# HAPI v2 expects base64-encoded "app_name:email" (order reversed from v1)
APP_IDENTIFIER = base64.b64encode(f"{APP_NAME}:{EMAIL}".encode()).decode()

BASE_URL = "https://hapi.humdata.org/api/v2"
OPENAPI_URL = "https://hapi.humdata.org/openapi.json"
OUTPUT_DIR = "output"

SOURCE_COOP_BUCKET = "us-west-2.opendata.source.coop"
SOURCE_COOP_REGION = "us-west-2"
# Set to "<org>/<product>" — e.g. "hdx/hapi"
SOURCE_COOP_PREFIX: str = os.environ.get("SOURCE_COOP_PREFIX", "")
_prefix = SOURCE_COOP_PREFIX.strip("/")
SOURCE_COOP_BASE_URL: str = f"https://data.source.coop/{_prefix}/" if _prefix else ""

UTILITY_TAGS = {"Generate App Identifier", "Util"}
