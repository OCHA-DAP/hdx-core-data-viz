export type FieldType = "dimension" | "metric";
export type Domain = "affected-people" | "food-security" | "coordination" | "geography" | "climate";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
}

export interface Dataset {
  id: string;
  label: string;
  description: string;
  domain: Domain;
  url: string;
  fields: Field[];
  defaultDimension: string;
  defaultMetric: string;
  hasTemporal: boolean;
  countColumn?: string;
}

const BASE = "https://data.source.coop/hdx/hapi";

export const DOMAIN_COLORS: Record<Domain, string> = {
  "affected-people": "#457b9d",
  "food-security": "#e63946",
  "coordination": "#6a0572",
  "geography": "#0e7c7b",
  "climate": "#2196f3",
};

export const DOMAIN_LABELS: Record<Domain, string> = {
  "affected-people": "Affected People",
  "food-security": "Food Security & Poverty",
  "coordination": "Coordination Context",
  "geography": "Geography",
  "climate": "Climate",
};

export const DATASETS: Record<string, Dataset> = {
  "baseline-population": {
    id: "baseline-population",
    label: "Baseline Population",
    description: "Total population disaggregated by admin level, age range, and gender",
    domain: "geography",
    url: `${BASE}/geography-infrastructure/baseline-population.parquet`,
    fields: [
      { key: "location_name", label: "Country", type: "dimension" },
      { key: "admin1_name", label: "Admin 1", type: "dimension" },
      { key: "gender", label: "Gender", type: "dimension" },
      { key: "age_range", label: "Age Range", type: "dimension" },
      { key: "population", label: "Population", type: "metric" },
    ],
    defaultDimension: "location_name",
    defaultMetric: "population",
    hasTemporal: true,
  },

  "food-security": {
    id: "food-security",
    label: "Food Security (IPC/CH)",
    description: "IPC/CH food security classification by phase and area",
    domain: "food-security",
    url: `${BASE}/food-security-nutrition-poverty/food-security.parquet`,
    fields: [
      { key: "location_name", label: "Country", type: "dimension" },
      { key: "admin1_name", label: "Admin 1", type: "dimension" },
      { key: "ipc_phase", label: "IPC Phase", type: "dimension" },
      { key: "ipc_type", label: "IPC Type", type: "dimension" },
      { key: "population_in_phase", label: "Population in Phase", type: "metric" },
      { key: "population_fraction_in_phase", label: "Fraction in Phase (%)", type: "metric" },
    ],
    defaultDimension: "location_name",
    defaultMetric: "population_in_phase",
    hasTemporal: true,
  },

  "humanitarian-needs": {
    id: "humanitarian-needs",
    label: "Humanitarian Needs (HNO)",
    description: "Population in need by sector, category, and status",
    domain: "affected-people",
    url: `${BASE}/affected-people/humanitarian-needs.parquet`,
    fields: [
      { key: "location_name", label: "Country", type: "dimension" },
      { key: "admin1_name", label: "Admin 1", type: "dimension" },
      { key: "sector_code", label: "Sector", type: "dimension" },
      { key: "category", label: "Category", type: "dimension" },
      { key: "population_status", label: "Population Status", type: "dimension" },
      { key: "population", label: "Population", type: "metric" },
    ],
    defaultDimension: "sector_code",
    defaultMetric: "population",
    hasTemporal: true,
  },

  "idps": {
    id: "idps",
    label: "Internally Displaced Persons",
    description: "IDP population estimates by location and assessment type",
    domain: "affected-people",
    url: `${BASE}/affected-people/idps.parquet`,
    fields: [
      { key: "location_name", label: "Country", type: "dimension" },
      { key: "admin1_name", label: "Admin 1", type: "dimension" },
      { key: "assessment_type", label: "Assessment Type", type: "dimension" },
      { key: "operation", label: "Operation", type: "dimension" },
      { key: "population", label: "Population", type: "metric" },
    ],
    defaultDimension: "location_name",
    defaultMetric: "population",
    hasTemporal: true,
  },

  "refugees-persons-of-concern": {
    id: "refugees-persons-of-concern",
    label: "Refugees & Persons of Concern",
    description: "UNHCR refugee and PoC data by country and population group",
    domain: "affected-people",
    url: `${BASE}/affected-people/refugees-persons-of-concern.parquet`,
    fields: [
      { key: "location_name", label: "Country of Asylum", type: "dimension" },
      { key: "origin_location_name", label: "Country of Origin", type: "dimension" },
      { key: "population_group", label: "Population Group", type: "dimension" },
      { key: "population", label: "Population", type: "metric" },
    ],
    defaultDimension: "location_name",
    defaultMetric: "population",
    hasTemporal: true,
  },

  "returnees": {
    id: "returnees",
    label: "Returnees",
    description: "Returnee population by location",
    domain: "affected-people",
    url: `${BASE}/affected-people/returnees.parquet`,
    fields: [
      { key: "location_name", label: "Country", type: "dimension" },
      { key: "admin1_name", label: "Admin 1", type: "dimension" },
      { key: "population", label: "Population", type: "metric" },
    ],
    defaultDimension: "location_name",
    defaultMetric: "population",
    hasTemporal: true,
  },

  "operational-presence": {
    id: "operational-presence",
    label: "Operational Presence (3W)",
    description: "Who does What Where — organizations and sectors active per location",
    domain: "coordination",
    url: `${BASE}/coordination-context/operational-presence.parquet`,
    fields: [
      { key: "location_name", label: "Country", type: "dimension" },
      { key: "admin1_name", label: "Admin 1", type: "dimension" },
      { key: "sector_name", label: "Sector", type: "dimension" },
      { key: "org_type_description", label: "Org Type", type: "dimension" },
      { key: "org_acronym", label: "Organization", type: "dimension" },
    ],
    defaultDimension: "location_name",
    defaultMetric: "count",
    hasTemporal: true,
    countColumn: "org_acronym",
  },

  "conflict-events": {
    id: "conflict-events",
    label: "Conflict Events (ACLED)",
    description: "Conflict event counts and fatalities by location, type, and time",
    domain: "coordination",
    url: `${BASE}/coordination-context/conflict-events.parquet`,
    fields: [
      { key: "location_name", label: "Country", type: "dimension" },
      { key: "admin1_name", label: "Admin 1", type: "dimension" },
      { key: "event_type", label: "Event Type", type: "dimension" },
      { key: "events", label: "Events", type: "metric" },
      { key: "fatalities", label: "Fatalities", type: "metric" },
    ],
    defaultDimension: "event_type",
    defaultMetric: "events",
    hasTemporal: true,
  },

  "funding": {
    id: "funding",
    label: "Funding & Appeals",
    description: "Humanitarian appeal requirements, contributions, and funding gaps",
    domain: "coordination",
    url: `${BASE}/coordination-context/funding.parquet`,
    fields: [
      { key: "location_name", label: "Country", type: "dimension" },
      { key: "appeal_type", label: "Appeal Type", type: "dimension" },
      { key: "requirements_usd", label: "Requirements (USD)", type: "metric" },
      { key: "funding_usd", label: "Funding (USD)", type: "metric" },
      { key: "funding_pct", label: "Funding %", type: "metric" },
    ],
    defaultDimension: "location_name",
    defaultMetric: "funding_pct",
    hasTemporal: true,
  },

  "rainfall": {
    id: "rainfall",
    label: "Rainfall Anomaly (CHIRPS)",
    description: "Rainfall vs. long-term average and anomaly percentage by admin area",
    domain: "climate",
    url: `${BASE}/climate/rainfall.parquet`,
    fields: [
      { key: "location_name", label: "Country", type: "dimension" },
      { key: "admin1_name", label: "Admin 1", type: "dimension" },
      { key: "aggregation_period", label: "Aggregation Period", type: "dimension" },
      { key: "rainfall", label: "Rainfall (mm)", type: "metric" },
      { key: "rainfall_long_term_average", label: "Long-term Avg (mm)", type: "metric" },
      { key: "rainfall_anomaly_pct", label: "Anomaly %", type: "metric" },
    ],
    defaultDimension: "location_name",
    defaultMetric: "rainfall_anomaly_pct",
    hasTemporal: true,
  },
};

export const DATASET_LIST = Object.values(DATASETS);

export const METADATA_URL = {
  location: `${BASE}/metadata/location.parquet`,
};
