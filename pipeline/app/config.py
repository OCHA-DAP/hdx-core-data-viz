"""Configuration: credentials, API settings, and endpoint registry."""

import base64

EMAIL = "claude@maxmalynowsky.com"
APP_NAME = "hdx-hapi-cloud-native-poc"

# HAPI v2 expects base64-encoded "app_name:email" (order reversed from v1)
APP_IDENTIFIER = base64.b64encode(f"{APP_NAME}:{EMAIL}".encode()).decode()

BASE_URL = "https://hapi.humdata.org/api/v2"
OPENAPI_URL = "https://hapi.humdata.org/openapi.json"
OUTPUT_DIR = "output"

UTILITY_TAGS = {"Generate App Identifier", "Util"}
