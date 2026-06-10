import { asyncBufferFromUrl, parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

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
  yearNote?: string; // compact date range, e.g. "2017–2026"
  levelNote?: string; // coverage caveat, e.g. "sub-national coverage varies"
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

async function read(url: string, columns: string[]): Promise<Record<string, unknown>[]> {
  const file = await asyncBufferFromUrl({ url });
  return parquetReadObjects({ file, compressors, columns }) as Promise<Record<string, unknown>[]>;
}

async function safeRead(url: string, columns: string[]): Promise<Record<string, unknown>[]> {
  try {
    return await read(url, columns);
  } catch {
    return [];
  }
}

const num = (v: unknown): number => (v == null ? 0 : typeof v === "bigint" ? Number(v) : Number(v));

const getYear = (v: unknown): number => parseInt(String(v ?? "").slice(0, 4), 10) || 0;

function partUrl(path: string, level: AdminLevel): string {
  return `${BASE}/${path}/admin_level=${level}/part-0.parquet`;
}

export async function buildBubbleData(
  level: AdminLevel,
  parentCode: string | undefined,
  xId: string,
  yId: string,
  sizeId: string,
): Promise<BubbleRow[]> {
  const codeCol = level === 0 ? "location_code" : level === 1 ? "admin1_code" : "admin2_code";
  const nameCol = level === 0 ? "location_name" : level === 1 ? "admin1_name" : "admin2_name";
  const filterCol = level === 1 ? "location_code" : level === 2 ? "admin1_code" : null;
  const scopeCols = filterCol ? [filterCol] : [];

  const inScope = (r: Record<string, unknown>) =>
    !filterCol || !parentCode || r[filterCol] === parentCode;

  const ids = [xId, yId, sizeId];
  const needsConflict = ids.some((id) => id.startsWith("conflict_"));
  const needsFood = ids.includes("ipc_phase3_fraction");
  const needsIDPs = ids.includes("idp_population");
  const needsPoverty = ids.some((id) => id.startsWith("poverty_"));

  const [popRows, conflictRows, foodRows, idpRows, povertyRows, riskRows, fundingRows] =
    await Promise.all([
      // Always fetch: names + denominator for per-100K
      safeRead(partUrl("geography-infrastructure/baseline-population", level), [
        ...scopeCols,
        codeCol,
        nameCol,
        "gender",
        "age_range",
        "population",
        "reference_period_start",
      ]),
      needsConflict
        ? safeRead(partUrl("coordination-context/conflict-events", level), [
            ...scopeCols,
            codeCol,
            nameCol,
            "fatalities",
            "reference_period_start",
          ])
        : Promise.resolve([]),
      needsFood
        ? safeRead(partUrl("food-security-nutrition-poverty/food-security", level), [
            ...scopeCols,
            codeCol,
            "ipc_phase",
            "ipc_type",
            "population_fraction_in_phase",
            "reference_period_start",
          ])
        : Promise.resolve([]),
      needsIDPs
        ? safeRead(partUrl("affected-people/idps", level), [
            ...scopeCols,
            codeCol,
            "population",
            "reference_period_start",
          ])
        : Promise.resolve([]),
      needsPoverty
        ? safeRead(partUrl("food-security-nutrition-poverty/poverty-rate", level), [
            ...scopeCols,
            codeCol,
            "mpi",
            "headcount_ratio",
            "reference_period_start",
          ])
        : Promise.resolve([]),
      // Always at level 0: risk colors + optional risk score axis
      level === 0
        ? safeRead(`${BASE}/coordination-context/national-risk.parquet`, [
            "location_code",
            "risk_class",
            "overall_risk",
            "reference_period_start",
          ])
        : Promise.resolve([]),
      level === 0 && ids.includes("funding_gap_pct")
        ? safeRead(`${BASE}/coordination-context/funding.parquet`, [
            "location_code",
            "requirements_usd",
            "funding_usd",
            "reference_period_start",
          ])
        : Promise.resolve([]),
    ]);

  // Name map: baseline pop is reliable for all admin levels
  const nameMap = new Map<string, string>();
  for (const r of popRows) {
    if (inScope(r) && r[codeCol] && r[nameCol]) {
      nameMap.set(r[codeCol] as string, r[nameCol] as string);
    }
  }
  for (const r of conflictRows) {
    if (inScope(r) && r[codeCol] && r[nameCol] && !nameMap.has(r[codeCol] as string)) {
      nameMap.set(r[codeCol] as string, r[nameCol] as string);
    }
  }

  // Baseline population: latest year per code (denominator + optional size)
  const popByCode = new Map<string, number>();
  const popYearByCode = new Map<string, number>();
  for (const r of popRows) {
    if (!inScope(r) || r.gender !== "all" || r.age_range !== "all") continue;
    const code = r[codeCol] as string;
    const year = getYear(r.reference_period_start);
    if (!popYearByCode.has(code) || year > popYearByCode.get(code)!) {
      popYearByCode.set(code, year);
      popByCode.set(code, num(r.population));
    }
  }

  // Conflict fatalities: (code:year) → total
  const conflictMap = new Map<string, number>();
  for (const r of conflictRows) {
    if (!inScope(r)) continue;
    const k = `${r[codeCol]}:${getYear(r.reference_period_start)}`;
    conflictMap.set(k, (conflictMap.get(k) ?? 0) + num(r.fatalities));
  }

  // IPC Phase 3+ fraction: (code:year) → sum of phases 3+4+5 fractions
  const foodMap = new Map<string, number>();
  for (const r of foodRows) {
    if (!inScope(r)) continue;
    if (r.ipc_type !== "current") continue;
    if (!["3", "4", "5"].includes(r.ipc_phase as string)) continue;
    const k = `${r[codeCol]}:${getYear(r.reference_period_start)}`;
    foodMap.set(k, (foodMap.get(k) ?? 0) + num(r.population_fraction_in_phase));
  }

  // IDP population: (code:year) → total
  const idpMap = new Map<string, number>();
  for (const r of idpRows) {
    if (!inScope(r)) continue;
    const k = `${r[codeCol]}:${getYear(r.reference_period_start)}`;
    idpMap.set(k, (idpMap.get(k) ?? 0) + num(r.population));
  }

  // Poverty: (code:year) → headcount_ratio and mpi
  const povertyHeadcountMap = new Map<string, number>();
  const povertyMpiMap = new Map<string, number>();
  for (const r of povertyRows) {
    if (!inScope(r)) continue;
    const k = `${r[codeCol]}:${getYear(r.reference_period_start)}`;
    if (r.headcount_ratio != null) povertyHeadcountMap.set(k, num(r.headcount_ratio));
    if (r.mpi != null) povertyMpiMap.set(k, num(r.mpi));
  }

  // National risk: code → risk_class (color) + code:year → overall_risk
  const riskClassMap = new Map<string, string>();
  const riskScoreMap = new Map<string, number>();
  for (const r of riskRows) {
    if (r.risk_class) riskClassMap.set(r.location_code as string, r.risk_class as string);
    if (r.overall_risk != null) {
      const k = `${r.location_code}:${getYear(r.reference_period_start)}`;
      riskScoreMap.set(k, num(r.overall_risk));
    }
  }

  // Funding gap: (location_code:year) → (1 - funded/required) × 100
  const fundingReqMap = new Map<string, number>();
  const fundingActMap = new Map<string, number>();
  for (const r of fundingRows) {
    const k = `${r.location_code}:${getYear(r.reference_period_start)}`;
    fundingReqMap.set(k, (fundingReqMap.get(k) ?? 0) + num(r.requirements_usd));
    fundingActMap.set(k, (fundingActMap.get(k) ?? 0) + num(r.funding_usd));
  }
  const fundingGapMap = new Map<string, number>();
  for (const k of fundingReqMap.keys()) {
    const req = fundingReqMap.get(k)!;
    if (req > 0) {
      const funded = fundingActMap.get(k) ?? 0;
      fundingGapMap.set(k, Math.max(0, (1 - funded / req) * 100));
    }
  }

  function mapForId(id: string): Map<string, number> {
    switch (id) {
      case "conflict_fatalities_per_100k":
      case "conflict_fatalities":
        return conflictMap;
      case "ipc_phase3_fraction":
        return foodMap;
      case "idp_population":
        return idpMap;
      case "poverty_headcount_ratio":
        return povertyHeadcountMap;
      case "poverty_mpi":
        return povertyMpiMap;
      case "national_risk_overall":
        return riskScoreMap;
      case "funding_gap_pct":
        return fundingGapMap;
      default:
        return new Map();
    }
  }

  function getVal(id: string, k: string, code: string): number | null {
    switch (id) {
      case "conflict_fatalities_per_100k": {
        if (!conflictMap.has(k)) return null;
        const pop = popByCode.get(code);
        return pop ? (conflictMap.get(k)! / pop) * 100_000 : null;
      }
      case "conflict_fatalities":
        return conflictMap.has(k) ? conflictMap.get(k)! : null;
      case "ipc_phase3_fraction":
        return foodMap.has(k) ? foodMap.get(k)! : null;
      case "idp_population":
        return idpMap.get(k) ?? 0;
      case "poverty_headcount_ratio":
        return povertyHeadcountMap.has(k) ? povertyHeadcountMap.get(k)! : null;
      case "poverty_mpi":
        return povertyMpiMap.has(k) ? povertyMpiMap.get(k)! : null;
      case "national_risk_overall":
        return riskScoreMap.has(k) ? riskScoreMap.get(k)! : null;
      case "funding_gap_pct":
        return fundingGapMap.has(k) ? fundingGapMap.get(k)! : null;
      case "baseline_population":
        return popByCode.get(code) ?? 0;
      default:
        return null;
    }
  }

  // Keys driven by x and y maps; size never adds new (code:year) combinations
  const allKeys = new Set([...mapForId(xId).keys(), ...mapForId(yId).keys()]);

  const rows: BubbleRow[] = [];
  for (const k of allKeys) {
    const [code, yearStr] = k.split(":");
    const year = parseInt(yearStr, 10);
    if (!code || !year) continue;
    const name = nameMap.get(code);
    if (!name) continue;

    rows.push({
      code,
      name,
      year,
      x: getVal(xId, k, code),
      y: getVal(yId, k, code),
      size: getVal(sizeId, k, code) ?? 0,
      population: popByCode.get(code),
      risk_class: riskClassMap.get(code) ?? null,
    });
  }

  return rows;
}
