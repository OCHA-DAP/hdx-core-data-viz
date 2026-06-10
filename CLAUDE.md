# HDX Core Data Viz

## What this is

A browser-based explorer for HAPI (Humanitarian API) data — humanitarian datasets published by OCHA covering population, food security, displacement, funding, operational presence, conflict, and climate.

## Data source

All data comes from **cloud-native Parquet files hosted on Source Cooperative**, read directly in the browser using `hyparquet`. No backend server. HTTP range requests mean only the columns you ask for get downloaded.

- **Collection index**: `https://data.source.coop/hdx/hapi/collection.json` — STAC collection, links to sub-collections per domain
- **HAPI docs**: <https://hdx-hapi.readthedocs.io/en/latest/>

### URL patterns

Partitioned datasets (have admin_level subdirectories):

```text
https://data.source.coop/hdx/hapi/[category]/[dataset]/admin_level=[0|1|2]/part-0.parquet
```

Flat files (country-level only, no partitioning):

```text
https://data.source.coop/hdx/hapi/[category]/[dataset].parquet
```

## Available HAPI datasets

### Affected People

| Dataset            | Asset path                                            | Admin levels | Columns                                                                                                                                            |
| ------------------ | ----------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Humanitarian Needs | `affected-people/humanitarian-needs/`                 | 0, 1, 2      | location_code/name, admin1/2_code/name, admin_level, sector_code, sector_name, category, population_status, population, reference_period_start/end |
| IDPs               | `affected-people/idps/`                               | 0, 1, 2      | location_code/name, admin1/2_code/name, admin_level, reporting_round, assessment_type, operation, population, reference_period_start/end           |
| Refugees & PoC     | `affected-people/refugees-persons-of-concern.parquet` | 0 only       | population_group, gender, age_range, min/max_age, population, origin_location_code/name, asylum_location_code/name, reference_period_start/end     |
| Returnees          | `affected-people/returnees.parquet`                   | 0 only       | population_group, gender, age_range, min/max_age, population, origin_location_code/name, asylum_location_code/name, reference_period_start/end     |

### Climate

| Dataset           | Asset path          | Admin levels | Columns                                                                                                                                                                                 |
| ----------------- | ------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rainfall (CHIRPS) | `climate/rainfall/` | 0, 1, 2      | location_code/name, admin1/2_code/name, admin_level, aggregation_period, rainfall, rainfall_long_term_average, rainfall_anomaly_pct, number_pixels, version, reference_period_start/end |

### Coordination & Context

| Dataset                   | Asset path                                   | Admin levels | Columns                                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conflict Events (ACLED)   | `coordination-context/conflict-events/`      | 0, 1         | location_code/name, admin1/2_code/name, admin_level, event_type, events, fatalities, reference_period_start/end                                                                                               |
| Funding & Appeals         | `coordination-context/funding.parquet`       | 0 only       | appeal_code, appeal_name, appeal_type, requirements_usd, funding_usd, funding_pct, location_code/name, reference_period_start/end                                                                             |
| National Risk (INFORM)    | `coordination-context/national-risk.parquet` | 0 only       | risk_class, global_rank, overall_risk, hazard_exposure_risk, vulnerability_risk, coping_capacity_risk, meta_missing_indicators_pct, meta_avg_recentness_years, location_code/name, reference_period_start/end |
| Operational Presence (3W) | `coordination-context/operational-presence/` | 1, 2         | location_code/name, admin1/2_code/name, admin_level, org_acronym, org_name, sector_code, sector_name, org_type_code, org_type_description, reference_period_start/end                                         |

### Food Security, Nutrition & Poverty

| Dataset                | Asset path                                                    | Admin levels | Columns                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Food Prices (WFP VAM)  | `food-security-nutrition-poverty/food-prices-market-monitor/` | 0, 1, 2      | location_code/name, admin1/2_code/name, admin_level, market_code, market_name, commodity_code/name/category, currency_code, unit, price_flag, price_type, price, lat, lon, reference_period_start/end |
| Food Security (IPC/CH) | `food-security-nutrition-poverty/food-security/`              | 0, 1, 2      | location_code/name, admin1/2_code/name, admin_level, ipc_phase, ipc_type, population_in_phase, **population_fraction_in_phase**, reference_period_start/end                                           |
| Poverty Rate (MPI)     | `food-security-nutrition-poverty/poverty-rate/`               | 0, 1         | location_code/name, admin1_code/name, admin_level, **mpi**, **headcount_ratio**, **intensity_of_deprivation**, **vulnerable_to_poverty**, **in_severe_poverty**, reference_period_start/end           |

### Geography & Infrastructure

| Dataset             | Asset path                                      | Admin levels | Columns                                                                                                                                                                               |
| ------------------- | ----------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline Population | `geography-infrastructure/baseline-population/` | 0, 1, 2      | location_code/name, admin1/2_code/name, admin_level, gender, age_range, min/max_age, population, reference_period_start/end — filter to `gender="all" AND age_range="all"` for totals |

### Metadata (reference tables)

| Dataset                 | Asset path                                                       | Columns                                                                                       |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Location                | `metadata/location.parquet`                                      | id, code, name, has_hrp, in_gho, from_cods, reference_period_start/end                        |
| Admin1                  | `metadata/admin1/`                                               | —                                                                                             |
| Admin2                  | `metadata/admin2/`                                               | —                                                                                             |
| Data Availability       | `metadata/data-availability/`                                    | location_code/name, admin1/2_code/name, admin_level, category, subcategory, hapi_updated_date |
| Orgs                    | `metadata/org.parquet` / `metadata/org-type.parquet`             | —                                                                                             |
| Sectors                 | `metadata/sector.parquet`                                        | —                                                                                             |
| WFP Commodities/Markets | `metadata/wfp-commodity.parquet` / `metadata/wfp-market.parquet` | —                                                                                             |

## Geography hierarchy

All partitioned datasets share the same location columns:

- **Admin 0**: `location_code`, `location_name` (country)
- **Admin 1**: above + `admin1_code`, `admin1_name`
- **Admin 2**: above + `admin2_code`, `admin2_name`

The `metadata/location.parquet` file has `has_hrp` (has Humanitarian Response Plan) and `in_gho` (in Global Humanitarian Overview) flags useful for filtering to active crisis countries.

## Tech stack

- **Astro 6** — static site framework, pages in `src/pages/`
- **Svelte 5** — UI components (runes syntax), `client:only="svelte"` for browser-only
- **hyparquet** — Parquet reader that works in the browser
- **hyparquet-compressors** — compression support for hyparquet
- **Vega / Vega-Lite / vega-embed** — charting (installed, not yet used)
- **TypeScript** — strict mode

## Key notes

- Food security already has `population_fraction_in_phase` — the percentage is pre-calculated, no need to divide by population yourself
- National Risk (INFORM) scores are already normalized 0–10 scales; `risk_class` is a categorical label
- Poverty Rate (MPI) fields like `headcount_ratio` are already rates (0–1), not raw counts
- `metadata/location.parquet` `has_hrp` flag is the best filter for "active crisis countries"
- The data is humanitarian — raw counts without context are misleading; prefer rates/fractions where available
