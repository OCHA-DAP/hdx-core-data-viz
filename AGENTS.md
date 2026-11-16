# HDX Core Data Viz

## What this is

A browser-based explorer for HAPI (Humanitarian API) data — humanitarian datasets published by OCHA covering population, food security, displacement, funding, operational presence, conflict, and climate.

## Data source

All data comes from **cloud-native Parquet files hosted on Source Cooperative**, read directly in the browser using **DuckDB-WASM**. No backend server. The Python pipeline in `pipeline/` builds and uploads those files (see Data pipeline below).

- **HAPI docs**: <https://hdx-hapi.readthedocs.io/en/latest/>
- **Local STAC metadata**: `src/data/hapi/` — mirrors the Source Cooperative folder structure; run `npm run sync-stac` to refresh

### URL patterns

Partitioned datasets (have admin_level subdirectories):

```text
https://data.source.coop/hdx/hapi/[category]/[dataset]/admin_level=[0|1|2]/part-0.parquet
```

Flat files (country-level only, no partitioning):

```text
https://data.source.coop/hdx/hapi/[category]/[dataset].parquet
```

Whether a dataset is partitioned or flat, and its full column schema, is in the corresponding `src/data/hapi/[category]/[dataset].json` file under `properties.table:columns` and `assets.data.href`.

## Geography hierarchy

All partitioned datasets share the same location columns:

- **Admin 0**: `location_code`, `location_name` (country)
- **Admin 1**: above + `admin1_code`, `admin1_name`
- **Admin 2**: above + `admin2_code`, `admin2_name`

## Key data notes

- **Food security** (`food-security-nutrition-poverty/food-security/`) already has `population_fraction_in_phase` — the percentage is pre-calculated per IPC phase
- **National Risk** (`coordination-context/national-risk.parquet`) scores are normalized 0–10; `risk_class` is a categorical label (e.g. "Very High")
- **Poverty Rate** (`food-security-nutrition-poverty/poverty-rate/`) fields like `headcount_ratio` are already rates (0–1), not raw counts
- **Baseline Population** filter: use `gender="all" AND age_range="all"` for country/region totals
- **`metadata/location.parquet`** has `has_hrp` (has Humanitarian Response Plan) and `in_gho` (in Global Humanitarian Overview) — useful for filtering to active crisis countries
- Refugees and returnees use `origin_location_code/name` and `asylum_location_code/name` instead of the standard location hierarchy

## Tech stack

- **Astro 6** — static site framework, pages in `src/pages/`
- **Svelte 5** — UI components (runes syntax), `client:only="svelte"` for browser-only
- **@duckdb/duckdb-wasm** — Parquet reader and SQL engine that works in the browser
- **Vega / Vega-Lite / vega-embed** — charting (installed, not yet used)
- **TypeScript** — strict mode

## Data pipeline

Python 3.13 + uv ETL in `pipeline/` that pulls every HAPI v2 endpoint, writes Parquet and a STAC catalog to `catalog/` (gitignored), and syncs it to Source Cooperative. `pyproject.toml`, `uv.lock` and `.env` (copy `.env.example`) live at the repo root; run everything from there:

```bash
uv sync                          # install deps
uv run -m pipeline               # fetch all endpoints, write catalog/, upload if SOURCE_COOP_UPLOAD is set
uv run -m pipeline.migrate       # re-layout existing catalog/ Parquet and rebuild STAC, no fetching
uv run ruff check .              # lint (auto-fix enabled)
uv run ruff format .             # format
```

No tests yet.

Flow: `extract.discover_endpoints() → extract.fetch_endpoint() → load.write_parquet() → stac.build_collection() → upload.sync_output()`

- **config.py**: constants and env settings (`OUTPUT_DIR`, HAPI URLs, Source Cooperative bucket/prefix).
- **extract.py**: discovers data endpoints and their Arrow schemas from the HAPI OpenAPI spec; pages through each with `offset`/`limit`, retrying network errors, 429 and 5xx.
- **load.py**: writes ZSTD Parquet to `catalog/<theme>/`, Hive-partitioned by `admin_level` where the dataset has one, else a single `<name>.parquet`; returns the temporal range.
- **stac.py**: writes the root `collection.json`, per-theme child collections and one Item JSON per endpoint.
- **upload.py**: syncs `catalog/` to Source Cooperative, skipping files whose size and MD5 match.
- **migrate.py**: rebuilds the layout and STAC from Parquet already in `catalog/`.

Notes:

- `sync_output` uploads, then deletes remote files missing from `catalog/`. It refuses to run without `catalog/collection.json`, but a partial catalog still deletes remote data; set `SOURCE_COOP_UPLOAD=` (empty) in `.env` for local runs.
- `catalog/` is not cleared between runs, so files for endpoints dropped upstream stay local and on the remote.
- `SOURCE_COOP_PREFIX` is `<org>/<product>` (`hdx/hapi`); the org is the S3 bucket, and `AWS_ENDPOINT_URL=https://data.source.coop` must be set.
- Ruff runs with `lint.select = ["ALL"]`; docstrings are required on all public symbols.
- `APP_IDENTIFIER` in config.py is a base64 `app_name:email` tracking token (not auth), built from `EMAIL`/`APP_NAME` in `.env`.

## Testing / running the UI

Use **`playwright-cli`** (installed at `/opt/homebrew/bin/playwright-cli`) to drive the browser for UI verification. It maintains a persistent session so you don't need to re-navigate between commands:

```bash
playwright-cli open "http://localhost:4321/"   # open (dev server must be running)
playwright-cli snapshot                                # inspect DOM / get element refs
playwright-cli screenshot --filename /tmp/out.png      # take a screenshot
playwright-cli click <element-ref>                     # click an element
playwright-cli eval "<js expression>"                  # run JS in the page
playwright-cli close                                   # close when done
```

Start the dev server first: `npm run dev`

## Design principle

The data is humanitarian — raw counts without context are misleading. Prefer rates and fractions where available (many datasets already provide them). When showing counts, always contextualize against population.
