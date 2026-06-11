#!/usr/bin/env node
// Downloads STAC collection and item JSONs from Source Cooperative into src/data/hapi/,
// mirroring the remote folder structure. Crawls the STAC link graph dynamically —
// no hard-coded file list needed. Removes local files no longer present on the remote.

import { writeFileSync, mkdirSync, rmSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = "https://data.source.coop/hdx/hapi";
const OUT = join(fileURLToPath(import.meta.url), "../../src/data/hapi");

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const saved = new Set();

function save(url, json) {
  const path = url.slice(ROOT.length + 1);
  const dest = join(OUT, path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(json, null, 2));
  saved.add(dest);
  console.log(`ok   ${path}`);
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith(".json")) yield full;
  }
}

function linksOf(json, rel) {
  return (json.links ?? []).filter((l) => l.rel === rel).map((l) => l.href);
}

const root = await fetchJson(`${ROOT}/collection.json`);
save(`${ROOT}/collection.json`, root);

for (const childUrl of linksOf(root, "child")) {
  const child = await fetchJson(childUrl);
  save(childUrl, child);

  for (const itemUrl of linksOf(child, "item")) {
    let item;
    try {
      item = await fetchJson(itemUrl);
    } catch (e) {
      console.error(`FAIL ${itemUrl} (${e instanceof Error ? e.message : e})`);
      continue;
    }
    save(itemUrl, item);
  }
}

for (const file of walk(OUT)) {
  if (!saved.has(file)) {
    rmSync(file);
    console.log(`del  ${file.slice(OUT.length + 1)}`);
  }
}
