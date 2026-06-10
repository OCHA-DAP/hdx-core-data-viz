import { asyncBufferFromUrl, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'

const BASE = 'https://data.source.coop/hdx/hapi'

export type AdminLevel = 0 | 1 | 2

export interface BubbleRow {
  code: string
  name: string
  year: number
  fatalities: number
  fatalities_per_100k: number | null
  ipc_phase3_fraction: number | null
  idp_population: number
  population: number | undefined
  risk_class: string | null
}

async function read(url: string, columns: string[]): Promise<Record<string, unknown>[]> {
  const file = await asyncBufferFromUrl({ url })
  return parquetReadObjects({ file, compressors, columns }) as Promise<Record<string, unknown>[]>
}

const num = (v: unknown): number =>
  v == null ? 0 : typeof v === 'bigint' ? Number(v) : Number(v)

const getYear = (v: unknown): number =>
  parseInt(String(v ?? '').slice(0, 4), 10) || 0

function partUrl(path: string, level: AdminLevel): string {
  return `${BASE}/${path}/admin_level=${level}/part-0.parquet`
}

export async function buildBubbleData(
  level: AdminLevel,
  parentCode?: string
): Promise<BubbleRow[]> {
  const codeCol = level === 0 ? 'location_code' : level === 1 ? 'admin1_code' : 'admin2_code'
  const nameCol = level === 0 ? 'location_name' : level === 1 ? 'admin1_name' : 'admin2_name'
  const filterCol = level === 1 ? 'location_code' : level === 2 ? 'admin1_code' : null

  const inScope = (r: Record<string, unknown>) =>
    !filterCol || !parentCode || r[filterCol] === parentCode

  const scopeCols = filterCol ? [filterCol] : []

  // 1. National risk (flat file, country level only)
  const riskMap = new Map<string, string>()
  if (level === 0) {
    const rows = await read(`${BASE}/coordination-context/national-risk.parquet`, [
      'location_code',
      'risk_class',
    ])
    for (const r of rows) riskMap.set(r.location_code as string, r.risk_class as string)
  }

  // 2. Load partitioned datasets in parallel
  const [conflictRows, foodRows, idpRows, popRows] = await Promise.all([
    read(partUrl('coordination-context/conflict-events', level), [
      ...scopeCols,
      codeCol,
      nameCol,
      'fatalities',
      'reference_period_start',
    ]),
    read(partUrl('food-security-nutrition-poverty/food-security', level), [
      ...scopeCols,
      codeCol,
      'ipc_phase',
      'ipc_type',
      'population_fraction_in_phase',
      'reference_period_start',
    ]),
    read(partUrl('affected-people/idps', level), [
      ...scopeCols,
      codeCol,
      'population',
      'reference_period_start',
    ]),
    read(partUrl('geography-infrastructure/baseline-population', level), [
      ...scopeCols,
      codeCol,
      'gender',
      'age_range',
      'population',
      'reference_period_start',
    ]),
  ])

  // Build name lookup from conflict rows (most complete coverage)
  const nameMap = new Map<string, string>()
  for (const r of conflictRows) {
    if (inScope(r) && r[codeCol] && r[nameCol]) {
      nameMap.set(r[codeCol] as string, r[nameCol] as string)
    }
  }

  // Aggregate conflict fatalities: (code:year) → total fatalities
  const fatalities = new Map<string, number>()
  for (const r of conflictRows) {
    if (!inScope(r)) continue
    const k = `${r[codeCol]}:${getYear(r.reference_period_start)}`
    fatalities.set(k, (fatalities.get(k) ?? 0) + num(r.fatalities))
  }

  // Aggregate IPC Phase 3+ fraction: (code:year) → summed fraction
  // Uses individual phases 3, 4, 5 (not cumulative "3P") to avoid double-counting
  const ipcFractions = new Map<string, number>()
  for (const r of foodRows) {
    if (!inScope(r)) continue
    if (r.ipc_type !== 'current') continue
    if (!['3', '4', '5'].includes(r.ipc_phase as string)) continue
    const k = `${r[codeCol]}:${getYear(r.reference_period_start)}`
    ipcFractions.set(k, (ipcFractions.get(k) ?? 0) + num(r.population_fraction_in_phase))
  }

  // Aggregate IDP population: (code:year) → total IDPs
  const idpPop = new Map<string, number>()
  for (const r of idpRows) {
    if (!inScope(r)) continue
    const k = `${r[codeCol]}:${getYear(r.reference_period_start)}`
    idpPop.set(k, (idpPop.get(k) ?? 0) + num(r.population))
  }

  // Baseline population: latest year per code (gender=all, age_range=all)
  const popByCode = new Map<string, number>()
  const popYearByCode = new Map<string, number>()
  for (const r of popRows) {
    if (!inScope(r)) continue
    if (r.gender !== 'all' || r.age_range !== 'all') continue
    const code = r[codeCol] as string
    const year = getYear(r.reference_period_start)
    if (!popYearByCode.has(code) || year > popYearByCode.get(code)!) {
      popYearByCode.set(code, year)
      popByCode.set(code, num(r.population))
    }
  }

  // Collect all (code, year) pairs and join
  const allKeys = new Set([...fatalities.keys(), ...ipcFractions.keys(), ...idpPop.keys()])
  const rows: BubbleRow[] = []

  for (const k of allKeys) {
    const [code, yearStr] = k.split(':')
    const year = parseInt(yearStr, 10)
    if (!code || !year) continue

    const name = nameMap.get(code)
    if (!name) continue

    const pop = popByCode.get(code)
    const fat = fatalities.get(k) ?? 0

    rows.push({
      code,
      name,
      year,
      fatalities: fat,
      fatalities_per_100k: pop ? (fat / pop) * 100_000 : null,
      ipc_phase3_fraction: ipcFractions.has(k) ? ipcFractions.get(k)! : null,
      idp_population: idpPop.get(k) ?? 0,
      population: pop ?? undefined,
      risk_class: riskMap.get(code) ?? null,
    })
  }

  return rows
}
