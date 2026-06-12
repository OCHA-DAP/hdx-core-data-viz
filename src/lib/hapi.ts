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
  subNationalOnly?: true;
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
  {
    id: "hum_needs_per_100k",
    label: "People in humanitarian need per 100K",
    format: (v) => v.toFixed(0),
    scale: "linear",
    min: 0,
    yearNote: "2024–2026",
    levelNote: "intersectoral total, 24 countries",
  },
  {
    id: "refugees_per_100k",
    label: "Refugees & asylum seekers hosted per 100K",
    format: (v) => v.toFixed(0),
    scale: "linear",
    min: 0,
    levelOnly: 0,
    yearNote: "2010–2026",
  },
  {
    id: "rainfall_anomaly_pct",
    label: "Rainfall anomaly vs long-term average",
    format: (v) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%",
    scale: "linear",
    min: -100,
    max: 100,
    subNationalOnly: true,
    yearNote: "2022–2026",
    levelNote: "deviation from long-term avg (0 = normal, − = drier, + = wetter)",
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
  {
    id: "hum_needs_total",
    label: "People in humanitarian need",
    format: (v) => v.toLocaleString(),
    scale: "linear",
    sizeMax: 50_000_000,
    yearNote: "2024–2026",
    sizeExamples: [
      { value: 0, label: "0" },
      { value: 15_000_000, label: "15 M" },
      { value: 30_000_000, label: "30 M" },
      { value: 50_000_000, label: "50 M" },
    ],
  },
  {
    id: "refugees_total",
    label: "Refugees & asylum seekers hosted",
    format: (v) => v.toLocaleString(),
    scale: "linear",
    sizeMax: 10_000_000,
    levelOnly: 0,
    yearNote: "2010–2026",
    sizeExamples: [
      { value: 0, label: "0" },
      { value: 3_000_000, label: "3 M" },
      { value: 6_000_000, label: "6 M" },
      { value: 10_000_000, label: "10 M" },
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

export type DataStatus = "available" | "aggregated" | "unavailable" | "not-needed";

export interface DataAvailability {
  population: DataStatus;
  conflict: DataStatus;
  food: DataStatus;
  humNeeds: DataStatus;
  idps: DataStatus;
  poverty: DataStatus;
  rainfall: DataStatus;
  refugees: DataStatus;
}

export interface BubbleResult {
  rows: BubbleRow[];
  availability: DataAvailability;
}

export interface AvailabilityRow {
  locationCode: string;
  locationName: string;
  category: string;
  subcategory: string;
  adminLevel: number;
  latestDate: string;
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
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const conn = await db.connect();
    await conn.query("SET enable_http_metadata_cache=true; SET enable_object_cache=true;");
    return conn;
  })();
  return connPromise;
}

// Warm up DuckDB immediately when the module loads
getConn();

// ── Result cache ──────────────────────────────────────────────────────────────

const cache = new Map<string, BubbleResult>();

// ── URL availability cache ────────────────────────────────────────────────────

const missing = new Set<string>();

async function urlExists(url: string): Promise<boolean> {
  if (missing.has(url)) return false;
  // Range-fetch first 4 bytes and verify Parquet magic "PAR1". A plain HEAD
  // returning 200 isn't enough — empty or corrupt files also return 200.
  const res = await fetch(url, { headers: { Range: "bytes=0-3" } });
  if (!res.ok) {
    missing.add(url);
    return false;
  }
  const b = new Uint8Array(await res.arrayBuffer());
  const ok = b[0] === 0x50 && b[1] === 0x41 && b[2] === 0x52 && b[3] === 0x31; // PAR1
  if (!ok) missing.add(url);
  return ok;
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function partUrl(path: string, level: AdminLevel): string {
  return `${BASE}/${path}/admin_level=${level}/part-0.parquet`;
}

// ── Drillability pre-check ────────────────────────────────────────────────────

// Returns the set of location codes that have no sub-national population data
// (neither admin_level=1 nor the admin_level=2 fallback). Call this after the
// level-0 chart loads so bubbles can be faded before the user clicks them.
export async function fetchNonDrillableCodes(codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set();
  const pop = "geography-infrastructure/baseline-population";
  const url1 = partUrl(pop, 1);
  const url2 = partUrl(pop, 2);
  const [ok1, ok2] = await Promise.all([urlExists(url1), urlExists(url2)]);
  if (!ok1 && !ok2) return new Set(codes);
  const conn = await getConn();
  const inList = codes.map((c) => `'${c}'`).join(", ");
  const parts: string[] = [];
  if (ok1)
    parts.push(
      `SELECT DISTINCT location_code FROM read_parquet('${url1}', hive_partitioning=false) WHERE location_code IN (${inList})`,
    );
  if (ok2)
    parts.push(
      `SELECT DISTINCT location_code FROM read_parquet('${url2}', hive_partitioning=false) WHERE location_code IN (${inList})`,
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await conn.query(parts.join(" UNION "));
  const drillable = new Set(result.toArray().map((r: any) => String(r.location_code)));
  return new Set(codes.filter((c) => !drillable.has(c)));
}

// ── Main query ────────────────────────────────────────────────────────────────

export async function buildBubbleData(
  level: AdminLevel,
  parentCode: string | undefined,
  xId: string,
  yId: string,
  sizeId: string,
): Promise<BubbleResult> {
  const cacheKey = `${level}|${parentCode ?? ""}|${xId}|${yId}|${sizeId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const conn = await getConn();

  const codeCol = level === 0 ? "location_code" : level === 1 ? "admin1_code" : "admin2_code";
  const nameCol = level === 0 ? "location_name" : level === 1 ? "admin1_name" : "admin2_name";
  const filterCol = level === 1 ? "location_code" : level === 2 ? "admin1_code" : null;
  const filterClause = filterCol && parentCode ? `AND ${filterCol} = '${parentCode}'` : "";

  const ids = [xId, yId, sizeId];
  const needsConflict = ids.some((id) => id.startsWith("conflict_"));
  const needsFood = ids.includes("ipc_phase3_fraction");
  const needsIDPs = ids.includes("idp_population");
  const needsPoverty = ids.some((id) => id.startsWith("poverty_"));
  const needsRisk = level === 0;
  const needsFunding = level === 0 && ids.includes("funding_gap_pct");
  const needsHumNeeds = ids.some((id) => id.startsWith("hum_needs"));
  const needsRefugees = level === 0 && ids.some((id) => id.startsWith("refugees_"));
  const needsRainfall = level > 0 && ids.includes("rainfall_anomaly_pct");

  const popUrl = partUrl("geography-infrastructure/baseline-population", level);
  const conflictUrl = partUrl("coordination-context/conflict-events", level);
  const foodUrl = partUrl("food-security-nutrition-poverty/food-security", level);
  const idpUrl = partUrl("affected-people/idps", level);
  const povertyUrl = partUrl("food-security-nutrition-poverty/poverty-rate", level);
  const riskUrl = `${BASE}/coordination-context/national-risk.parquet`;
  const fundingUrl = `${BASE}/coordination-context/funding.parquet`;
  const humNeedsUrl = partUrl("affected-people/humanitarian-needs", level);
  let humNeedsFbUrl: string | null = level < 2 ? partUrl("affected-people/humanitarian-needs", (level + 1) as AdminLevel) : null;
  const rainfallUrl = needsRainfall ? partUrl("climate/rainfall", level) : null;
  const rainfallFbUrl = level === 1 && needsRainfall ? partUrl("climate/rainfall", 2) : null;
  const refugeesUrl = `${BASE}/affected-people/refugees-persons-of-concern.parquet`;

  // Summable datasets fall back to finer admin levels when the target level file is missing.
  // These are initialised for level 1/2; the level-0 block overrides them after cascade checks.
  // Fraction-based datasets (food, poverty) cannot be safely summed, so they stay empty.
  const popFbUrl = level === 1 ? partUrl("geography-infrastructure/baseline-population", 2) : null;
  let conflictFbUrl: string | null = level < 2 ? partUrl("coordination-context/conflict-events", (level + 1) as AdminLevel) : null;
  let idpFbUrl: string | null = level < 2 ? partUrl("affected-people/idps", (level + 1) as AdminLevel) : null;

  // At level 0, summable datasets check admin_level=0 and fall back to admin_level=1 if missing
  // (the level-0 SQL already groups by location_code so aggregation is correct). At level 1,
  // data-availability tells us per-country which datasets and levels are present — urlExists
  // can't do this since all countries now share a single file per level. At level 2 there is
  // no fallback, so urlExists on the shared file suffices.
  let popOk: boolean,
    conflictOk: boolean,
    foodOk: boolean,
    idpOk: boolean,
    povertyOk: boolean,
    popFbOk: boolean,
    conflictFbOk: boolean,
    idpFbOk: boolean,
    humNeedsOk: boolean,
    humNeedsFbOk: boolean,
    rainfallOk: boolean,
    rainfallFbOk: boolean;

  if (level === 0) {
    // For summable datasets: admin_level=0 → admin_level=1 → admin_level=2.
    // Fraction-based datasets (food, poverty) are hardcoded true — they can't be aggregated.
    const conflictL1Url = partUrl("coordination-context/conflict-events", 1);
    const conflictL2Url = partUrl("coordination-context/conflict-events", 2);
    const idpL1Url = partUrl("affected-people/idps", 1);
    const idpL2Url = partUrl("affected-people/idps", 2);
    const humNeedsL1Url = partUrl("affected-people/humanitarian-needs", 1);
    const humNeedsL2Url = partUrl("affected-people/humanitarian-needs", 2);

    const [conflictL0Ok, idpL0Ok, humNeedsL0Ok] = await Promise.all([
      needsConflict ? urlExists(conflictUrl) : Promise.resolve(false),
      needsIDPs ? urlExists(idpUrl) : Promise.resolve(false),
      needsHumNeeds ? urlExists(humNeedsUrl) : Promise.resolve(false),
    ]);
    const [conflictL1Ok, idpL1Ok, humNeedsL1Ok] = await Promise.all([
      needsConflict && !conflictL0Ok ? urlExists(conflictL1Url) : Promise.resolve(false),
      needsIDPs && !idpL0Ok ? urlExists(idpL1Url) : Promise.resolve(false),
      needsHumNeeds && !humNeedsL0Ok ? urlExists(humNeedsL1Url) : Promise.resolve(false),
    ]);
    const [conflictL2Ok, idpL2Ok, humNeedsL2Ok] = await Promise.all([
      needsConflict && !conflictL0Ok && !conflictL1Ok ? urlExists(conflictL2Url) : Promise.resolve(false),
      needsIDPs && !idpL0Ok && !idpL1Ok ? urlExists(idpL2Url) : Promise.resolve(false),
      needsHumNeeds && !humNeedsL0Ok && !humNeedsL1Ok ? urlExists(humNeedsL2Url) : Promise.resolve(false),
    ]);

    // Override fallback URLs to point to whichever level was found
    conflictFbUrl = conflictL1Ok ? conflictL1Url : conflictL2Ok ? conflictL2Url : null;
    idpFbUrl = idpL1Ok ? idpL1Url : idpL2Ok ? idpL2Url : null;
    humNeedsFbUrl = humNeedsL1Ok ? humNeedsL1Url : humNeedsL2Ok ? humNeedsL2Url : null;

    [
      popOk,
      conflictOk,
      foodOk,
      idpOk,
      povertyOk,
      popFbOk,
      conflictFbOk,
      idpFbOk,
      humNeedsOk,
      humNeedsFbOk,
      rainfallOk,
      rainfallFbOk,
    ] = [
      true, conflictL0Ok, true, idpL0Ok, true, false,
      conflictL1Ok || conflictL2Ok, idpL1Ok || idpL2Ok,
      humNeedsL0Ok, humNeedsL1Ok || humNeedsL2Ok,
      false, false,
    ];
  } else if (level === 1) {
    const [a1, a2] = await Promise.all([
      fetchSubNationalAvailability([parentCode!], 1),
      fetchSubNationalAvailability([parentCode!], 2),
    ]);
    const avail1 = new Set(a1.map((r) => r.subcategory));
    const avail2 = new Set(a2.map((r) => r.subcategory));
    popOk = avail1.has("baseline-population");
    conflictOk = needsConflict && avail1.has("conflict-events");
    foodOk = needsFood && avail1.has("food-security");
    idpOk = needsIDPs && avail1.has("idps");
    povertyOk = needsPoverty && avail1.has("poverty-rate");
    popFbOk = !popOk && avail2.has("baseline-population");
    conflictFbOk = needsConflict && !conflictOk && avail2.has("conflict-events");
    idpFbOk = needsIDPs && !idpOk && avail2.has("idps");
    humNeedsOk = needsHumNeeds && avail1.has("humanitarian-needs");
    humNeedsFbOk = needsHumNeeds && !humNeedsOk && avail2.has("humanitarian-needs");
    rainfallOk = needsRainfall && avail1.has("rainfall");
    rainfallFbOk = needsRainfall && !rainfallOk && avail2.has("rainfall");
  } else {
    [
      popOk,
      conflictOk,
      foodOk,
      idpOk,
      povertyOk,
      popFbOk,
      conflictFbOk,
      idpFbOk,
      humNeedsOk,
      humNeedsFbOk,
      rainfallOk,
      rainfallFbOk,
    ] = await Promise.all([
      urlExists(popUrl),
      needsConflict ? urlExists(conflictUrl) : Promise.resolve(false),
      needsFood ? urlExists(foodUrl) : Promise.resolve(false),
      needsIDPs ? urlExists(idpUrl) : Promise.resolve(false),
      needsPoverty ? urlExists(povertyUrl) : Promise.resolve(false),
      Promise.resolve(false),
      Promise.resolve(false),
      Promise.resolve(false),
      needsHumNeeds ? urlExists(humNeedsUrl) : Promise.resolve(false),
      Promise.resolve(false),
      needsRainfall && rainfallUrl ? urlExists(rainfallUrl) : Promise.resolve(false),
      Promise.resolve(false),
    ]);
  }

  const popIsAdmin2 = !popOk && popFbOk;
  const effectivePopUrl = popOk ? popUrl : popFbOk ? popFbUrl! : null;
  const effectiveConflictUrl = conflictOk ? conflictUrl : conflictFbOk ? conflictFbUrl! : null;
  const effectiveIdpUrl = idpOk ? idpUrl : idpFbOk ? idpFbUrl! : null;
  const humNeedsIsAdmin2 = !humNeedsOk && humNeedsFbOk;
  const effectiveHumNeedsUrl = humNeedsOk ? humNeedsUrl : humNeedsFbOk ? humNeedsFbUrl! : null;
  const effectiveRainfallUrl = rainfallOk ? rainfallUrl : rainfallFbOk ? rainfallFbUrl! : null;

  const availability: DataAvailability = {
    population:
      level === 0 ? "available" : popOk ? "available" : popIsAdmin2 ? "aggregated" : "unavailable",
    conflict: !needsConflict
      ? "not-needed"
      : conflictOk
        ? "available"
        : conflictFbOk
          ? "aggregated"
          : "unavailable",
    food: !needsFood
      ? "not-needed"
      : level === 0
        ? "available"
        : foodOk
          ? "available"
          : "unavailable",
    humNeeds: !needsHumNeeds
      ? "not-needed"
      : level === 0
        ? "available"
        : humNeedsOk
          ? "available"
          : humNeedsFbOk
            ? "aggregated"
            : "unavailable",
    idps: !needsIDPs
      ? "not-needed"
      : level === 0
        ? "available"
        : idpOk
          ? "available"
          : idpFbOk
            ? "aggregated"
            : "unavailable",
    poverty: !needsPoverty
      ? "not-needed"
      : level === 0
        ? "available"
        : povertyOk
          ? "available"
          : "unavailable",
    rainfall: !needsRainfall
      ? "not-needed"
      : rainfallOk
        ? "available"
        : rainfallFbOk
          ? "aggregated"
          : "unavailable",
    refugees: !needsRefugees ? "not-needed" : "available",
  };

  // Population is the anchor — no pop data at this level means nothing to show.
  if (level > 0 && effectivePopUrl === null) {
    const result: BubbleResult = { rows: [], availability };
    cache.set(cacheKey, result);
    return result;
  }

  // Map each variable id to the CTE name that holds its (code, year) keys
  function xyCte(id: string): string {
    if (id.startsWith("conflict_")) return "conflict_agg";
    if (id === "ipc_phase3_fraction") return "food_agg";
    if (id === "idp_population") return "idp_agg";
    if (id.startsWith("poverty_")) return "poverty_agg";
    if (id === "national_risk_overall") return "risk_agg";
    if (id === "funding_gap_pct") return "funding_agg";
    if (id.startsWith("hum_needs")) return "hum_needs_agg";
    if (id.startsWith("refugees_")) return "refugees_agg";
    if (id === "rainfall_anomaly_pct") return "rainfall_agg";
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
      case "hum_needs_per_100k":
        return "hn.hum_needs_total * 100000.0 / NULLIF(p.population, 0)";
      case "hum_needs_total":
        return "COALESCE(hn.hum_needs_total, 0)";
      case "refugees_per_100k":
        return "rf.refugees_total * 100000.0 / NULLIF(p.population, 0)";
      case "refugees_total":
        return "COALESCE(rf.refugees_total, 0)";
      case "rainfall_anomaly_pct":
        return "ra.rainfall_anomaly_pct - 100.0";
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
  const needsHn = needsHumNeeds;
  const needsRf = needsRefugees;
  const needsRa = needsRainfall;

  const sql = `
WITH
pop AS (
  ${
    popIsAdmin2
      ? `SELECT ${codeCol} AS code, ${nameCol} AS name, SUM(population) AS population
  FROM read_parquet('${effectivePopUrl}', hive_partitioning=true)
  WHERE gender = 'all' AND age_range = 'all' ${filterClause}
  GROUP BY ${codeCol}, ${nameCol}, reference_period_start
  QUALIFY ROW_NUMBER() OVER (PARTITION BY ${codeCol} ORDER BY reference_period_start DESC) = 1`
      : `SELECT ${codeCol} AS code, ${nameCol} AS name, population
  FROM read_parquet('${effectivePopUrl}', hive_partitioning=true)
  WHERE gender = 'all' AND age_range = 'all' ${filterClause}
  QUALIFY ROW_NUMBER() OVER (PARTITION BY ${codeCol} ORDER BY reference_period_start DESC) = 1`
  }
)
${
  needsConflict
    ? `,
conflict_agg AS (
  ${
    effectiveConflictUrl
      ? `SELECT ${codeCol} AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         SUM(fatalities) AS fatalities
  FROM read_parquet('${effectiveConflictUrl}', hive_partitioning=true)
  WHERE 1=1 ${filterClause}
  GROUP BY code, year`
      : `SELECT NULL::VARCHAR AS code, NULL::INTEGER AS year, NULL::BIGINT AS fatalities WHERE FALSE`
  }
)`
    : ""
}
${
  needsFood
    ? `,
food_agg AS (
  ${
    foodOk
      ? `SELECT ${codeCol} AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         SUM(population_fraction_in_phase) AS ipc_phase3_fraction
  FROM read_parquet('${foodUrl}', hive_partitioning=true)
  WHERE ipc_type = 'current' AND ipc_phase IN ('3','4','5') ${filterClause}
  GROUP BY code, year`
      : `SELECT NULL::VARCHAR AS code, NULL::INTEGER AS year, NULL::DOUBLE AS ipc_phase3_fraction WHERE FALSE`
  }
)`
    : ""
}
${
  needsIDPs
    ? `,
idp_agg AS (
  ${
    effectiveIdpUrl
      ? `SELECT ${codeCol} AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         SUM(population) AS idp_population
  FROM read_parquet('${effectiveIdpUrl}', hive_partitioning=true)
  WHERE 1=1 ${filterClause}
  GROUP BY code, year`
      : `SELECT NULL::VARCHAR AS code, NULL::INTEGER AS year, NULL::BIGINT AS idp_population WHERE FALSE`
  }
)`
    : ""
}
${
  needsPoverty
    ? `,
poverty_agg AS (
  ${
    povertyOk
      ? `SELECT ${codeCol} AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         headcount_ratio, mpi
  FROM read_parquet('${povertyUrl}', hive_partitioning=true)
  WHERE 1=1 ${filterClause}`
      : `SELECT NULL::VARCHAR AS code, NULL::INTEGER AS year, NULL::DOUBLE AS headcount_ratio, NULL::DOUBLE AS mpi WHERE FALSE`
  }
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
${
  needsHumNeeds
    ? `,
hum_needs_agg AS (
  ${
    effectiveHumNeedsUrl
      ? `SELECT ${codeCol} AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         SUM(population) AS hum_needs_total
  FROM read_parquet('${effectiveHumNeedsUrl}', hive_partitioning=true)
  WHERE population_status = 'INN' AND sector_code = 'Intersectoral' ${filterClause}
  GROUP BY code, ${humNeedsIsAdmin2 ? `${nameCol}, ` : ""}year`
      : `SELECT NULL::VARCHAR AS code, NULL::INTEGER AS year, NULL::BIGINT AS hum_needs_total WHERE FALSE`
  }
)`
    : ""
}
${
  needsRefugees
    ? `,
refugees_agg AS (
  SELECT asylum_location_code AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         SUM(population) AS refugees_total
  FROM read_parquet('${refugeesUrl}')
  WHERE population_group IN ('REF', 'ASY')
    AND gender = 'all' AND age_range = 'all'
  GROUP BY code, year
)`
    : ""
}
${
  needsRainfall
    ? `,
rainfall_agg AS (
  ${
    effectiveRainfallUrl
      ? `SELECT ${codeCol} AS code,
         CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
         SUM(rainfall_anomaly_pct * number_pixels) / NULLIF(SUM(number_pixels), 0) AS rainfall_anomaly_pct
  FROM read_parquet('${effectiveRainfallUrl}', hive_partitioning=true)
  WHERE aggregation_period = '1-month' ${filterClause}
  GROUP BY code, year`
      : `SELECT NULL::VARCHAR AS code, NULL::INTEGER AS year, NULL::DOUBLE AS rainfall_anomaly_pct WHERE FALSE`
  }
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
${needsHn ? "LEFT JOIN hum_needs_agg hn USING (code, year)" : ""}
${needsRf ? "LEFT JOIN refugees_agg rf USING (code, year)" : ""}
${needsRa ? "LEFT JOIN rainfall_agg ra USING (code, year)" : ""}
WHERE p.name IS NOT NULL
  `;

  const queryResult = await conn.query(sql);
  const rows: BubbleRow[] = [];

  for (const row of queryResult.toArray()) {
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

  const result: BubbleResult = { rows, availability };
  cache.set(cacheKey, result);
  return result;
}

// ── Data availability matrix ──────────────────────────────────────────────────

let availabilityCache: AvailabilityRow[] | null = null;

function availUrl(level: number): string {
  return `${BASE}/metadata/data-availability/admin_level=${level}/part-0.parquet`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAvailRows(result: any, level: number): AvailabilityRow[] {
  const rows: AvailabilityRow[] = [];
  for (const row of result.toArray()) {
    rows.push({
      locationCode: String(row.location_code ?? ""),
      locationName: String(row.location_name ?? ""),
      category: String(row.category ?? ""),
      subcategory: String(row.subcategory ?? ""),
      adminLevel: level,
      latestDate: String(row.hapi_updated_date ?? ""),
    });
  }
  return rows;
}

// Returns national-level (admin_level=0) availability rows — fast, one file.
export async function fetchAvailabilityMatrix(): Promise<AvailabilityRow[]> {
  if (availabilityCache) return availabilityCache;
  const conn = await getConn();
  const sql = `
    SELECT location_code, location_name, category, subcategory, hapi_updated_date
    FROM read_parquet('${availUrl(0)}', hive_partitioning=false)
    ORDER BY location_name, category, subcategory
  `;

  const rows = parseAvailRows(await conn.query(sql), 0);
  availabilityCache = rows;
  return rows;
}

export async function fetchSubNationalAvailability(
  locationCodes: string[],
  level: 1 | 2,
): Promise<AvailabilityRow[]> {
  if (locationCodes.length === 0) return [];
  const conn = await getConn();
  const inList = locationCodes.map((c) => `'${c}'`).join(", ");
  const sql = `
    SELECT location_code, location_name, category, subcategory, hapi_updated_date
    FROM read_parquet('${availUrl(level)}', hive_partitioning=false)
    WHERE location_code IN (${inList})
    ORDER BY location_name, category, subcategory
  `;
  return parseAvailRows(await conn.query(sql), level);
}

// ── Country list ─────────────────────────────────────────────────────────────

export interface CountryRow {
  code: string;
  name: string;
  hasHrp: boolean;
  inGho: boolean;
}

let countryListCache: CountryRow[] | null = null;

export async function fetchCountryList(): Promise<CountryRow[]> {
  if (countryListCache) return countryListCache;
  const conn = await getConn();
  const url = `${BASE}/metadata/location.parquet`;
  const result = await conn.query(
    `SELECT code, name, has_hrp, in_gho FROM read_parquet('${url}') ORDER BY name`,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  countryListCache = result.toArray().map((r: any) => ({
    code: String(r.code),
    name: String(r.name),
    hasHrp: Boolean(r.has_hrp),
    inGho: Boolean(r.in_gho),
  }));
  return countryListCache!;
}

// ── Food price monitor ────────────────────────────────────────────────────────

export interface PricePoint {
  commodity: string;
  unit: string;
  currency: string;
  month: string; // "YYYY-MM"
  price: number;
}

const PRICE_BASE = `${BASE}/food-security-nutrition-poverty/food-prices-market-monitor`;
const priceCache = new Map<string, PricePoint[]>();
const priceCatCache = new Map<string, string[]>();

export async function fetchFoodPriceCategories(locationCode: string): Promise<string[]> {
  if (priceCatCache.has(locationCode)) return priceCatCache.get(locationCode)!;
  const conn = await getConn();
  const cats = new Set<string>();
  for (const lvl of [0, 1, 2]) {
    try {
      const result = await conn.query(
        `SELECT DISTINCT commodity_category
         FROM read_parquet('${PRICE_BASE}/admin_level=${lvl}/part-0.parquet', hive_partitioning=false)
         WHERE location_code = '${locationCode}' AND commodity_category IS NOT NULL
         ORDER BY commodity_category`,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of result.toArray()) cats.add(String(r.commodity_category));
    } catch { /* level not available for this country */ }
  }
  const sorted = [...cats].sort();
  priceCatCache.set(locationCode, sorted);
  return sorted;
}

export async function fetchFoodPrices(locationCode: string, commodityCategory: string): Promise<PricePoint[]> {
  const key = `${locationCode}|${commodityCategory}`;
  if (priceCache.has(key)) return priceCache.get(key)!;
  const conn = await getConn();
  const esc = commodityCategory.replace(/'/g, "''");
  // Collect raw price rows from all available admin levels
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRaw: any[] = [];
  for (const lvl of [0, 1, 2]) {
    try {
      const result = await conn.query(
        `SELECT commodity_name, unit, currency_code, reference_period_start, price
         FROM read_parquet('${PRICE_BASE}/admin_level=${lvl}/part-0.parquet', hive_partitioning=false)
         WHERE location_code = '${locationCode}' AND commodity_category = '${esc}'
           AND price_flag = 'actual' AND price > 0`,
      );
      allRaw.push(...result.toArray());
    } catch { /* level not available */ }
  }
  if (allRaw.length === 0) {
    priceCache.set(key, []);
    return [];
  }
  // Find top 8 commodities by frequency
  const freq = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of allRaw) freq.set(String(r.commodity_name), (freq.get(String(r.commodity_name)) ?? 0) + 1);
  const top8 = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  const top8Set = new Set(top8);
  // Aggregate by commodity + month
  const aggKey = (name: string, month: string, unit: string, currency: string) => `${name}||${month}||${unit}||${currency}`;
  const agg = new Map<string, { sum: number; count: number; commodity: string; unit: string; currency: string; month: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of allRaw) {
    const name = String(r.commodity_name);
    if (!top8Set.has(name)) continue;
    const month = String(r.reference_period_start).slice(0, 7); // "YYYY-MM"
    const unit = String(r.unit);
    const currency = String(r.currency_code);
    const k = aggKey(name, month, unit, currency);
    const existing = agg.get(k);
    if (existing) {
      existing.sum += Number(r.price);
      existing.count += 1;
    } else {
      agg.set(k, { sum: Number(r.price), count: 1, commodity: name, unit, currency, month });
    }
  }
  const rows: PricePoint[] = [...agg.values()]
    .map(({ sum, count, commodity, unit, currency, month }) => ({
      commodity, unit, currency, month, price: +(sum / count).toFixed(4),
    }))
    .sort((a, b) => a.commodity.localeCompare(b.commodity) || a.month.localeCompare(b.month));
  priceCache.set(key, rows);
  return rows;
}

// ── Crisis timeline ───────────────────────────────────────────────────────────

export interface TimelinePoint {
  year: number;
  conflictFatalities: number | null;
  idpPopulation: number | null;
  foodPhase3Pct: number | null;
  fundingGapPct: number | null;
}

const timelineCache = new Map<string, TimelinePoint[]>();

export async function fetchCrisisTimeline(locationCode: string): Promise<TimelinePoint[]> {
  if (timelineCache.has(locationCode)) return timelineCache.get(locationCode)!;
  const conn = await getConn();
  const loc = locationCode;

  // Run 4 queries in parallel; individual failures leave that indicator empty (null)
  const [conflictRows, idpRows, foodRows, fundingRows] = await Promise.all([
    // Conflict: ACLED events are at admin_level=2, aggregate to country
    conn.query(`
      SELECT CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year, SUM(fatalities) AS v
      FROM read_parquet('${BASE}/coordination-context/conflict-events/admin_level=2/part-0.parquet', hive_partitioning=false)
      WHERE location_code = '${loc}'
      GROUP BY year ORDER BY year
    `).catch(() => null),
    // IDPs: country-level (admin_level=0)
    conn.query(`
      SELECT CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year, SUM(population) AS v
      FROM read_parquet('${BASE}/affected-people/idps/admin_level=0/part-0.parquet', hive_partitioning=false)
      WHERE location_code = '${loc}'
      GROUP BY year ORDER BY year
    `).catch(() => null),
    // Food security Phase 3+: latest assessment per year
    conn.query(`
      SELECT year, LEAST(1.0, SUM(population_fraction_in_phase)) AS v
      FROM (
        SELECT CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
               reference_period_start, population_fraction_in_phase,
               MAX(reference_period_start) OVER (
                 PARTITION BY CAST(LEFT(reference_period_start, 4) AS INTEGER)
               ) AS latest_ref
        FROM read_parquet('${BASE}/food-security-nutrition-poverty/food-security/admin_level=0/part-0.parquet', hive_partitioning=false)
        WHERE location_code = '${loc}' AND ipc_type = 'current' AND ipc_phase IN ('3','4','5')
      )
      WHERE reference_period_start = latest_ref
      GROUP BY year ORDER BY year
    `).catch(() => null),
    // Funding gap: flat file
    conn.query(`
      SELECT CAST(LEFT(reference_period_start, 4) AS INTEGER) AS year,
             GREATEST(0.0, (1.0 - SUM(funding_usd) / NULLIF(SUM(requirements_usd), 0)) * 100) AS v
      FROM read_parquet('${BASE}/coordination-context/funding.parquet', hive_partitioning=false)
      WHERE location_code = '${loc}'
      GROUP BY year ORDER BY year
    `).catch(() => null),
  ]);

  // Build year-keyed maps from each result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function toMap(result: any): Map<number, number> {
    const m = new Map<number, number>();
    if (!result) return m;
    for (const r of result.toArray()) m.set(Number(r.year), Number(r.v));
    return m;
  }

  const conflict = toMap(conflictRows);
  const idps = toMap(idpRows);
  const food = toMap(foodRows);
  const funding = toMap(fundingRows);

  const yearSet = new Set([...conflict.keys(), ...idps.keys(), ...food.keys(), ...funding.keys()]);
  const rows: TimelinePoint[] = [...yearSet].sort((a, b) => a - b).map((year) => ({
    year,
    conflictFatalities: conflict.has(year) ? conflict.get(year)! : null,
    idpPopulation: idps.has(year) ? idps.get(year)! : null,
    foodPhase3Pct: food.has(year) ? food.get(year)! * 100 : null,
    fundingGapPct: funding.has(year) ? funding.get(year)! : null,
  }));

  timelineCache.set(locationCode, rows);
  return rows;
}

// ── IPC phase distribution ────────────────────────────────────────────────────

export interface IpcPhaseRow {
  locationName: string;
  locationCode: string;
  phase: string;
  fraction: number;
  year: number;
}

const ipcCache = new Map<string, IpcPhaseRow[]>();

export async function fetchIpcPhases(year: number | null): Promise<IpcPhaseRow[]> {
  const key = year == null ? "latest" : String(year);
  if (ipcCache.has(key)) return ipcCache.get(key)!;
  const conn = await getConn();
  const foodUrl = `${BASE}/food-security-nutrition-poverty/food-security/admin_level=0/part-0.parquet`;
  const yearCond =
    year != null
      ? `AND CAST(LEFT(reference_period_start, 4) AS INTEGER) = ${year}`
      : "";
  // Use MAX(reference_period_start) per country to pick only the latest assessment
  // period within the target year. Without this, countries with multiple IPC rounds
  // in the same year get their fractions summed, exceeding 100%.
  const sql =
    year != null
      ? `WITH latest AS (
           SELECT location_code, MAX(reference_period_start) AS max_period
           FROM read_parquet('${foodUrl}', hive_partitioning=false)
           WHERE ipc_type = 'current' ${yearCond}
           GROUP BY location_code
         )
         SELECT f.location_name, f.location_code, f.ipc_phase,
                SUM(f.population_fraction_in_phase) AS fraction, ${year} AS year
         FROM read_parquet('${foodUrl}', hive_partitioning=false) f
         JOIN latest l ON f.location_code = l.location_code
           AND f.reference_period_start = l.max_period
         WHERE f.ipc_type = 'current' AND f.ipc_phase IN ('1','2','3','4','5')
         GROUP BY f.location_name, f.location_code, f.ipc_phase ORDER BY f.location_name, f.ipc_phase`
      : `WITH latest AS (
           SELECT location_code, MAX(reference_period_start) AS max_period
           FROM read_parquet('${foodUrl}', hive_partitioning=false)
           WHERE ipc_type = 'current' GROUP BY location_code
         )
         SELECT f.location_name, f.location_code, f.ipc_phase,
                SUM(f.population_fraction_in_phase) AS fraction,
                CAST(LEFT(l.max_period, 4) AS INTEGER) AS year
         FROM read_parquet('${foodUrl}', hive_partitioning=false) f
         JOIN latest l ON f.location_code = l.location_code
           AND f.reference_period_start = l.max_period
         WHERE f.ipc_type = 'current' AND f.ipc_phase IN ('1','2','3','4','5')
         GROUP BY f.location_name, f.location_code, f.ipc_phase, l.max_period
         ORDER BY f.location_name, f.ipc_phase`;
  const result = await conn.query(sql);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: IpcPhaseRow[] = result.toArray().map((r: any) => ({
    locationName: String(r.location_name),
    locationCode: String(r.location_code),
    phase: String(r.ipc_phase),
    fraction: Number(r.fraction),
    year: Number(r.year),
  }));
  ipcCache.set(key, rows);
  return rows;
}

// ── Refugee flow query ────────────────────────────────────────────────────────

export interface FlowRow {
  origin: string;
  asylum: string;
  total: number;
}

const flowCache = new Map<string, FlowRow[]>();

export async function fetchRefugeeFlows(
  year: number,
  topN: number,
  groups: string[],
): Promise<FlowRow[]> {
  const cacheKey = `${year}|${topN}|${groups.join(",")}`;
  if (flowCache.has(cacheKey)) return flowCache.get(cacheKey)!;

  const conn = await getConn();
  const url = `${BASE}/affected-people/refugees-persons-of-concern.parquet`;
  const groupList = groups.map((g) => `'${g}'`).join(",");

  const sql = `
WITH top_countries AS (
  SELECT location_name, SUM(total) AS grand_total
  FROM (
    SELECT origin_location_name AS location_name, SUM(population) AS total
    FROM read_parquet('${url}', hive_partitioning=false)
    WHERE gender = 'all' AND age_range = 'all'
      AND population_group IN (${groupList})
      AND year(CAST(reference_period_end AS DATE)) = ${year}
    GROUP BY origin_location_name
    UNION ALL
    SELECT asylum_location_name AS location_name, SUM(population) AS total
    FROM read_parquet('${url}', hive_partitioning=false)
    WHERE gender = 'all' AND age_range = 'all'
      AND population_group IN (${groupList})
      AND year(CAST(reference_period_end AS DATE)) = ${year}
    GROUP BY asylum_location_name
  )
  GROUP BY location_name
  ORDER BY grand_total DESC
  LIMIT ${topN}
)
SELECT
  origin_location_name AS origin,
  asylum_location_name AS asylum,
  SUM(population) AS total
FROM read_parquet('${url}', hive_partitioning=false)
WHERE gender = 'all' AND age_range = 'all'
  AND population_group IN (${groupList})
  AND year(CAST(reference_period_end AS DATE)) = ${year}
  AND origin_location_name IN (SELECT location_name FROM top_countries)
  AND asylum_location_name IN (SELECT location_name FROM top_countries)
GROUP BY origin_location_name, asylum_location_name
HAVING SUM(population) > 0
ORDER BY total DESC
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: FlowRow[] = (await conn.query(sql)).toArray().map((r: any) => ({
    origin: String(r.origin),
    asylum: String(r.asylum),
    total: Number(r.total),
  }));

  flowCache.set(cacheKey, rows);
  return rows;
}
