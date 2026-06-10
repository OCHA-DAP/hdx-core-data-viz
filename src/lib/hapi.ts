import * as duckdb from "@duckdb/duckdb-wasm";

const BASE = "https://data.source.coop/hdx/hapi";

export type AdminLevel = 0 | 1 | 2;

export interface VariableSpec {
  id: string;
  label: string;
  format: (v: number) => string;
  scale: "linear" | "symlog";
  min?: number;
  max?: number;
  sizeMax?: number;
  sizeExamples?: { value: number; label: string }[];
  levelOnly?: 0;
  yearNote?: string;
  levelNote?: string;
}

export const AXIS_VARS: VariableSpec[] = [
  {
    id: "conflict_fatalities_per_100k",
    label: "Conflict fatalities per 100K population",
    format: (v) => v.toFixed(1),
    scale: "symlog",
    yearNote: "1997–2026",
  },
  {
    id: "ipc_phase3_fraction",
    label: "Population in IPC Phase 3+ food crisis",
    format: (v) => (v * 100).toFixed(1) + "%",
    scale: "linear",
    min: 0,
    max: 1,
    yearNote: "2017–2026",
    levelNote: "sub-national coverage varies by country",
  },
  {
    id: "poverty_headcount_ratio",
    label: "Poverty headcount ratio",
    format: (v) => (v * 100).toFixed(1) + "%",
    scale: "linear",
    min: 0,
    max: 1,
    yearNote: "2001–2024",
    levelNote: "survey-based, many gaps",
  },
  {
    id: "poverty_mpi",
    label: "Multidimensional Poverty Index (MPI)",
    format: (v) => v.toFixed(3),
    scale: "linear",
    min: 0,
    max: 1,
    yearNote: "2001–2024",
    levelNote: "survey-based, many gaps",
  },
  {
    id: "national_risk_overall",
    label: "Overall national risk score (0–10)",
    format: (v) => v.toFixed(1),
    scale: "linear",
    min: 0,
    max: 10,
    levelOnly: 0,
    yearNote: "2024 only",
  },
  {
    id: "funding_gap_pct",
    label: "Humanitarian funding gap",
    format: (v) => v.toFixed(1) + "%",
    scale: "linear",
    min: 0,
    max: 100,
    levelOnly: 0,
    yearNote: "1999–2031",
  },
];

export const SIZE_VARS: VariableSpec[] = [
  {
    id: "idp_population",
    label: "IDP population",
    format: (v) => v.toLocaleString(),
    scale: "linear",
    sizeMax: 30_000_000,
    yearNote: "2010–2026",
    sizeExamples: [
      { value: 0, label: "0" },
      { value: 10_000_000, label: "10 M" },
      { value: 20_000_000, label: "20 M" },
      { value: 30_000_000, label: "30 M" },
    ],
  },
  {
    id: "baseline_population",
    label: "Total population",
    format: (v) => v.toLocaleString(),
    scale: "linear",
    sizeMax: 1_400_000_000,
    yearNote: "latest estimate per country",
    sizeExamples: [
      { value: 0, label: "0" },
      { value: 500_000_000, label: "500 M" },
      { value: 1_000_000_000, label: "1 B" },
      { value: 1_400_000_000, label: "1.4 B" },
    ],
  },
  {
    id: "conflict_fatalities",
    label: "Conflict fatalities",
    format: (v) => v.toLocaleString(),
    scale: "linear",
    sizeMax: 100_000,
    yearNote: "1997–2026",
    sizeExamples: [
      { value: 0, label: "0" },
      { value: 30_000, label: "30 K" },
      { value: 60_000, label: "60 K" },
      { value: 100_000, label: "100 K" },
    ],
  },
];

export interface BubbleRow {
  code: string;
  name: string;
  year: number;
  x: number | null;
  y: number | null;
  size: number;
  population?: number;
  risk_class?: string | null;
}

// ── DuckDB singleton ──────────────────────────────────────────────────────────

let connPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;

function getConn(): Promise<duckdb.AsyncDuckDBConnection> {
  if (connPromise) return connPromise;
  connPromise = (async () => {
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }),
    );
    const worker = new Worker(workerUrl);
    URL.revokeObjectURL(workerUrl);
    const db = new duckdb.AsyncDuckDB(
      new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING),
      worker,
    );
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const conn = await db.connect();
    await conn.query(
      "SET enable_http_metadata_cache=true; SET enable_object_cache=true;",
    );
    return conn;
  })();
  return connPromise;
}

// Warm up DuckDB immediately when the module loads
getConn();

// ── Result cache ──────────────────────────────────────────────────────────────

const cache = new Map<string, BubbleRow[]>();

// ── URL helpers ───────────────────────────────────────────────────────────────

function partUrl(path: string, level: AdminLevel): string {
  return `${BASE}/${path}/admin_level=${level}/part-0.parquet`;
}

// ── Main query ────────────────────────────────────────────────────────────────

export async function buildBubbleData(
  level: AdminLevel,
  parentCode: string | undefined,
  xId: string,
  yId: string,
  sizeId: string,
): Promise<BubbleRow[]> {
  const cacheKey = `${level}|${parentCode ?? ""}|${xId}|${yId}|${sizeId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const conn = await getConn();

  const codeCol = level === 0 ? "location_code" : level === 1 ? "admin1_code" : "admin2_code";
  const nameCol = level === 0 ? "location_name" : level === 1 ? "admin1_name" : "admin2_name";
  const filterCol = level === 1 ? "location_code" : level === 2 ? "admin1_code" : null;
  const filterClause =
    filterCol && parentCode ? `AND ${filterCol} = '${parentCode}'` : "";

  const ids = [xId, yId, sizeId];
  const needsConflict = ids.some((id) => id.startsWith("conflict_"));
  const needsFood = ids.includes("ipc_phase3_fraction");
  const needsIDPs = ids.includes("idp_population");
  const needsPoverty = ids.some((id) => id.startsWith("poverty_"));
  const needsRisk = level === 0;
  const needsFunding = level === 0 && ids.includes("funding_gap_pct");

  const popUrl = partUrl("geography-infrastructure/baseline-population", level);
  const conflictUrl = partUrl("coordination-context/conflict-events", level);
  const foodUrl = partUrl("food-security-nutrition-poverty/food-security", level);
  const idpUrl = partUrl("affected-people/idps", level);
  const povertyUrl = partUrl("food-security-nutrition-poverty/poverty-rate", level);
  const riskUrl = `${BASE}/coordination-context/national-risk.parquet`;
  const fundingUrl = `${BASE}/coordination-context/funding.parquet`;

  // Map each variable id to the CTE name that holds its (code, year) keys
  function xyCte(id: string): string {
    if (id.startsWith("conflict_")) return "conflict_agg";
    if (id === "ipc_phase3_fraction") return "food_agg";
    if (id === "idp_population") return "idp_agg";
    if (id.startsWith("poverty_")) return "poverty_agg";
    if (id === "national_risk_overall") return "risk_agg";
    if (id === "funding_gap_pct") return "funding_agg";
    return "pop"; // baseline_population — use pop as anchor
  }

  // SQL expression for each variable in the final SELECT
  function varExpr(id: string): string {
    switch (id) {
      case "conflict_fatalities_per_100k":
        return "c.fatalities * 100000.0 / NULLIF(p.population, 0)";
      case "conflict_fatalities":
        return "c.fatalities";
      case "ipc_phase3_fraction":
        return "f.ipc_phase3_fraction";
      case "idp_population":
        return "COALESCE(i.idp_population, 0)";
      case "poverty_headcount_ratio":
        return "pv.headcount_ratio";
      case "poverty_mpi":
        return "pv.mpi";
      case "national_risk_overall":
        return "r.overall_risk";
      case "funding_gap_pct":
        return "GREATEST(0.0, (1.0 - fn.funded / NULLIF(fn.req, 0)) * 100.0)";
      case "baseline_population":
        return "CAST(p.population AS DOUBLE)";
      default:
        return "NULL";
    }
  }

  const xCteName = xyCte(xId);
  const yCteName = xyCte(yId);

  // Determine which JOIN aliases are referenced in the final SELECT
  const needsC = needsConflict;
  const needsF = needsFood;
  const needsI = needsIDPs;
  const needsPv = needsPoverty;
  const needsFn = needsFunding;

  const sql = `
WITH
pop AS (
  SELECT ${codeCol} AS code, ${nameCol} AS name, population
  FROM read_parquet('${popUrl}')
  WHERE gender = 'all' AND age_range = 'all' ${filterClause}
  QUALIFY ROW_NUMBER() OVER (PARTITION BY ${codeCol} ORDER BY reference_period_start DESC) = 1
)
${
  needsConflict
    ? `,
conflict_agg AS (
  SELECT ${codeCol} AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         SUM(fatalities) AS fatalities
  FROM read_parquet('${conflictUrl}')
  WHERE 1=1 ${filterClause}
  GROUP BY code, year
)`
    : ""
}
${
  needsFood
    ? `,
food_agg AS (
  SELECT ${codeCol} AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         SUM(population_fraction_in_phase) AS ipc_phase3_fraction
  FROM read_parquet('${foodUrl}')
  WHERE ipc_type = 'current' AND ipc_phase IN ('3','4','5') ${filterClause}
  GROUP BY code, year
)`
    : ""
}
${
  needsIDPs
    ? `,
idp_agg AS (
  SELECT ${codeCol} AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         SUM(population) AS idp_population
  FROM read_parquet('${idpUrl}')
  WHERE 1=1 ${filterClause}
  GROUP BY code, year
)`
    : ""
}
${
  needsPoverty
    ? `,
poverty_agg AS (
  SELECT ${codeCol} AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         headcount_ratio, mpi
  FROM read_parquet('${povertyUrl}')
  WHERE 1=1 ${filterClause}
)`
    : ""
}
${
  needsRisk
    ? `,
risk_agg AS (
  SELECT location_code AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         risk_class, overall_risk
  FROM read_parquet('${riskUrl}')
  QUALIFY ROW_NUMBER() OVER (PARTITION BY location_code ORDER BY reference_period_start DESC) = 1
)`
    : ""
}
${
  needsFunding
    ? `,
funding_agg AS (
  SELECT location_code AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         SUM(requirements_usd) AS req,
         SUM(funding_usd) AS funded
  FROM read_parquet('${fundingUrl}')
  GROUP BY code, year
)`
    : ""
}
,
xy_keys AS (
  SELECT code, year FROM ${xCteName}
  UNION
  SELECT code, year FROM ${yCteName}
)
SELECT
  k.code,
  k.year,
  p.name,
  p.population,
  ${varExpr(xId)} AS x,
  ${varExpr(yId)} AS y,
  ${varExpr(sizeId)} AS size,
  ${needsRisk ? "r.risk_class" : "NULL AS risk_class"}
FROM xy_keys k
LEFT JOIN pop p USING (code)
${needsC ? "LEFT JOIN conflict_agg c USING (code, year)" : ""}
${needsF ? "LEFT JOIN food_agg f USING (code, year)" : ""}
${needsI ? "LEFT JOIN idp_agg i USING (code, year)" : ""}
${needsPv ? "LEFT JOIN poverty_agg pv USING (code, year)" : ""}
${needsRisk ? "LEFT JOIN risk_agg r ON k.code = r.code" : ""}
${needsFn ? "LEFT JOIN funding_agg fn USING (code, year)" : ""}
WHERE p.name IS NOT NULL
  `;

  const result = await conn.query(sql);
  const rows: BubbleRow[] = [];

  for (const row of result.toArray()) {
    const code = String(row.code ?? "");
    const year = Number(row.year ?? 0);
    if (!code || !year) continue;
    rows.push({
      code,
      name: String(row.name ?? ""),
      year,
      x: row.x == null ? null : Number(row.x),
      y: row.y == null ? null : Number(row.y),
      size: row.size == null ? 0 : Number(row.size),
      population: row.population == null ? undefined : Number(row.population),
      risk_class: row.risk_class == null ? null : String(row.risk_class),
    });
  }

  cache.set(cacheKey, rows);
  return rows;
}
