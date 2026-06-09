const BASE = "https://data.source.coop/hdx/hapi";

export interface Lens {
  id: string;
  title: string;
  description: string;
  icon: string;
  useCase: string;
  useCaseLabel: string;
  datasetId: string;
  sql: string;
}

export const LENSES: Lens[] = [
  {
    id: "emergency-response",
    title: "Emergency Response Snapshot",
    description:
      "How many organizations are active in each crisis country, and across which sectors?",
    icon: "🆘",
    useCase: "UC-01",
    useCaseLabel: "Emergency Response Activation",
    datasetId: "operational-presence",
    sql: `SELECT
  location_name AS dim,
  COUNT(DISTINCT org_acronym) AS value
FROM read_parquet('${BASE}/coordination-context/operational-presence.parquet')
GROUP BY location_name
ORDER BY value DESC
LIMIT 30`,
  },

  {
    id: "funding-gap",
    title: "Funding Gap Analysis",
    description:
      "Countries with the largest humanitarian funding shortfalls relative to stated need.",
    icon: "💰",
    useCase: "UC-02",
    useCaseLabel: "Funding Gap Analysis",
    datasetId: "funding",
    sql: `SELECT
  location_name AS dim,
  ROUND(MAX(requirements_usd) - MAX(funding_usd)) AS value
FROM read_parquet('${BASE}/coordination-context/funding.parquet')
WHERE requirements_usd > 0
GROUP BY location_name
ORDER BY value DESC NULLS LAST
LIMIT 30`,
  },

  {
    id: "displacement",
    title: "Displacement Overview",
    description: "Countries with the largest internally displaced populations (latest data).",
    icon: "🏕️",
    useCase: "UC-03",
    useCaseLabel: "Displacement Trend Monitoring",
    datasetId: "idps",
    sql: `SELECT
  location_name AS dim,
  SUM(TRY_CAST(population AS DOUBLE)) AS value
FROM read_parquet('${BASE}/affected-people/idps.parquet')
WHERE reference_period_end = (
  SELECT MAX(reference_period_end)
  FROM read_parquet('${BASE}/affected-people/idps.parquet')
)
GROUP BY location_name
ORDER BY value DESC NULLS LAST
LIMIT 30`,
  },

  {
    id: "food-insecurity",
    title: "Food Insecurity (IPC Phase 3+)",
    description: "Population in crisis or emergency food insecurity by country.",
    icon: "🌾",
    useCase: "UC-04",
    useCaseLabel: "Anticipatory Action & Risk Monitoring",
    datasetId: "food-security",
    sql: `SELECT
  location_name AS dim,
  SUM(TRY_CAST(population_in_phase AS DOUBLE)) AS value
FROM read_parquet('${BASE}/food-security-nutrition-poverty/food-security.parquet')
WHERE CAST(ipc_phase AS INTEGER) >= 3
  AND ipc_type = 'current'
GROUP BY location_name
ORDER BY value DESC NULLS LAST
LIMIT 30`,
  },

  {
    id: "needs-vs-funding",
    title: "Needs vs. Funding Coverage",
    description:
      "Cross-domain: food insecurity population size against appeal funding coverage percentage.",
    icon: "⚖️",
    useCase: "UC-05",
    useCaseLabel: "Cross-Domain Federated Analysis",
    datasetId: "funding",
    sql: `SELECT
  n.location_name AS dim,
  SUM(TRY_CAST(n.population_in_phase AS DOUBLE)) AS pop_in_crisis,
  ROUND(MAX(f.funding_pct), 1) AS funding_pct
FROM read_parquet('${BASE}/food-security-nutrition-poverty/food-security.parquet') n
LEFT JOIN read_parquet('${BASE}/coordination-context/funding.parquet') f
  ON n.location_code = f.location_code
WHERE CAST(n.ipc_phase AS INTEGER) >= 3
  AND n.ipc_type = 'current'
  AND f.requirements_usd > 0
GROUP BY n.location_name
HAVING pop_in_crisis > 0
ORDER BY pop_in_crisis DESC
LIMIT 25`,
  },
];

export const COMING_SOON = [
  {
    id: "risk-early-warning",
    title: "Risk & Early Warning",
    description: "Monitor hazard exposure and vulnerability indicators before emergency declaration.",
    icon: "⚠️",
    exampleQuestion: "Which high-vulnerability countries have active climate hazard signals but no declared emergency?",
  },
  {
    id: "hazardous-events",
    title: "Hazardous Events",
    description: "Track natural and man-made hazard events linked to emergency declarations.",
    icon: "🌊",
    exampleQuestion: "What is the frequency and severity trend of climate-related hazards in Sahel countries over the past 5 years?",
  },
  {
    id: "situation-analysis",
    title: "Situation Analysis & Needs",
    description: "Access comparable needs assessments and severity scores across organizations.",
    icon: "📊",
    exampleQuestion: "How do multi-sector needs assessment scores correlate with funding received?",
  },
  {
    id: "market-assessments",
    title: "Market Assessments",
    description: "Food commodity prices, market functionality, and access indicators.",
    icon: "🏪",
    exampleQuestion: "In which admin areas are market prices more than 2x the national average alongside IPC Phase 3+ food insecurity?",
  },
];
