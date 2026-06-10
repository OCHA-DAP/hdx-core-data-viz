# HDX Core Data Viz

## What this is

A browser-based explorer for HAPI (Humanitarian API) data — humanitarian datasets published by OCHA covering population, food security, displacement, funding, operational presence, conflict, and climate.

## Data source

All data comes from **cloud-native Parquet files hosted on Source Cooperative**, read directly in the browser using `hyparquet`. No backend server. HTTP range requests mean only the columns you ask for get downloaded.

- **HAPI docs**: https://hdx-hapi.readthedocs.io/en/latest/
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
- **hyparquet** + **hyparquet-compressors** — Parquet reader that works in the browser
- **Vega / Vega-Lite / vega-embed** — charting (installed, not yet used)
- **TypeScript** — strict mode

## Testing / running the UI

Use **`playwright-cli`** (installed at `/opt/homebrew/bin/playwright-cli`) to drive the browser for UI verification. It maintains a persistent session so you don't need to re-navigate between commands:

```bash
playwright-cli open "http://localhost:4323/explore"   # open (dev server must be running)
playwright-cli snapshot                                # inspect DOM / get element refs
playwright-cli screenshot --filename /tmp/out.png      # take a screenshot
playwright-cli click <element-ref>                     # click an element
playwright-cli eval "<js expression>"                  # run JS in the page
playwright-cli close                                   # close when done
```

Start the dev server first: `npm run dev -- --port 4323`

## Design principle

The data is humanitarian — raw counts without context are misleading. Prefer rates and fractions where available (many datasets already provide them). When showing counts, always contextualize against population.
