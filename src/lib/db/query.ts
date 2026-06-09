import { DATASETS } from "$lib/hapi/datasets";

export interface TableQueryParams {
  datasetId: string;
  dimension: string;
  metric: string;
  country?: string;
  limit?: number;
}

export interface TrendQueryParams {
  datasetId: string;
  metric: string;
  country: string;
}

function metricExpr(metric: string, datasetId: string): string {
  const ds = DATASETS[datasetId];
  if (metric === "count" && ds?.countColumn) {
    return `COUNT(DISTINCT "${ds.countColumn}")`;
  }
  return `SUM(TRY_CAST("${metric}" AS DOUBLE))`;
}

function locationFilter(country: string | undefined): string {
  if (!country) return "";
  // location_code is the ISO 3-letter code; sanitize to alpha chars only.
  const safe = country.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3);
  return `AND location_code = '${safe}'`;
}

export function buildTableQuery(params: TableQueryParams): string {
  const ds = DATASETS[params.datasetId];
  const expr = metricExpr(params.metric, params.datasetId);
  const where = locationFilter(params.country);
  const limit = params.limit ?? 100;

  return `SELECT
  "${params.dimension}" AS dim,
  ${expr} AS value
FROM read_parquet('${ds.url}')
WHERE dim IS NOT NULL
  ${where}
GROUP BY "${params.dimension}"
ORDER BY value DESC NULLS LAST
LIMIT ${limit}`;
}

export function buildTrendQuery(params: TrendQueryParams): string {
  const ds = DATASETS[params.datasetId];
  const expr = metricExpr(params.metric, params.datasetId);
  const safe = params.country.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3);

  return `SELECT
  strftime(TRY_CAST(reference_period_start AS DATE), '%Y-%m') AS period,
  ${expr} AS value
FROM read_parquet('${ds.url}')
WHERE location_code = '${safe}'
  AND reference_period_start IS NOT NULL
GROUP BY period
ORDER BY period`;
}
