#!/usr/bin/env node
// Downloads STAC collection and item JSONs from Source Cooperative into src/data/hapi/,
// mirroring the remote folder structure.

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = "https://data.source.coop/hdx/hapi";
const OUT = join(fileURLToPath(import.meta.url), "../../src/data/hapi");

const FILES = [
  "collection.json",
  "affected-people/collection.json",
  "affected-people/humanitarian-needs.json",
  "affected-people/idps.json",
  "affected-people/refugees-persons-of-concern.json",
  "affected-people/returnees.json",
  "climate/collection.json",
  "climate/rainfall.json",
  "coordination-context/collection.json",
  "coordination-context/conflict-events.json",
  "coordination-context/funding.json",
  "coordination-context/national-risk.json",
  "coordination-context/operational-presence.json",
  "food-security-nutrition-poverty/collection.json",
  "food-security-nutrition-poverty/food-prices-market-monitor.json",
  "food-security-nutrition-poverty/food-security.json",
  "food-security-nutrition-poverty/poverty-rate.json",
  "geography-infrastructure/collection.json",
  "geography-infrastructure/baseline-population.json",
  "metadata/collection.json",
  "metadata/admin1.json",
  "metadata/admin2.json",
  "metadata/currency.json",
  "metadata/data-availability.json",
  "metadata/dataset.json",
  "metadata/location.json",
  "metadata/org-type.json",
  "metadata/org.json",
  "metadata/resource.json",
  "metadata/sector.json",
  "metadata/wfp-commodity.json",
  "metadata/wfp-market.json",
];

for (const file of FILES) {
  const url = `${ROOT}/${file}`;
  const dest = join(OUT, file);
  mkdirSync(dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAIL ${file} (${res.status})`);
    continue;
  }
  const json = await res.json();
  writeFileSync(dest, JSON.stringify(json, null, 2));
  console.log(`ok   ${file}`);
}
