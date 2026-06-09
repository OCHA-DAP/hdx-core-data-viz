<script lang="ts">
  import { onMount } from "svelte";
  import { duckdbState, initDuckDB, runQuery } from "$lib/db/duckdb.svelte";
  import { buildTableQuery, buildTrendQuery } from "$lib/db/query";
  import { DATASET_LIST, DATASETS, METADATA_URL } from "$lib/hapi/datasets";
  import { LENSES } from "$lib/hapi/lenses";
  import DatasetChip from "./DatasetChip.svelte";
  import LoadingSpinner from "./LoadingSpinner.svelte";
  import ResultChart from "./ResultChart.svelte";
  import ResultTable from "./ResultTable.svelte";
  import SqlPreview from "./SqlPreview.svelte";

  // ── Query state ──────────────────────────────────────────────
  let datasetId = $state("food-security");
  let mode = $state<"table" | "trend">("table");
  let country = $state("");
  let dimension = $state("location_name");
  let metric = $state("population_in_phase");
  let resultView = $state<"table" | "chart" | "sql">("table");

  let running = $state(false);
  let results = $state<Record<string, unknown>[]>([]);
  let queryError = $state<string | null>(null);
  let activeSql = $state("");
  let activeLensId = $state<string | null>(null);

  let countries = $state<{ code: string; name: string }[]>([]);
  let countriesLoaded = $state(false);

  // ── Derived ───────────────────────────────────────────────────
  let currentDataset = $derived(DATASETS[datasetId] ?? DATASETS["food-security"]);
  let dimensions = $derived(currentDataset.fields.filter((f) => f.type === "dimension"));
  let metrics = $derived([
    ...(currentDataset.countColumn ? [{ key: "count", label: "Count (distinct)" }] : []),
    ...currentDataset.fields.filter((f) => f.type === "metric"),
  ]);
  let dimLabel = $derived(
    currentDataset.fields.find((f) => f.key === dimension)?.label ?? dimension
  );
  let metricLabel = $derived(
    metrics.find((m) => m.key === metric)?.label ?? metric
  );

  // Reset dim/metric when dataset changes.
  $effect(() => {
    const ds = DATASETS[datasetId];
    if (!ds) return;
    dimension = ds.defaultDimension;
    metric = ds.defaultMetric;
  });

  // ── Lifecycle ────────────────────────────────────────────────
  onMount(async () => {
    await initDuckDB();
    if (duckdbState.ready) {
      void loadCountries();
      checkLensParam();
    }
  });

  async function loadCountries() {
    try {
      const rows = await runQuery(
        `SELECT location_code AS code, location_name AS name
         FROM read_parquet('${METADATA_URL.location}')
         ORDER BY name`
      );
      countries = rows as { code: string; name: string }[];
      countriesLoaded = true;
    } catch {
      // Non-fatal — country filter will just be unavailable.
    }
  }

  function checkLensParam() {
    const params = new URLSearchParams(window.location.search);
    const lensId = params.get("lens");
    if (lensId) {
      const found = LENSES.find((l) => l.id === lensId);
      if (found) void execLens(found.id);
    }
  }

  // ── Actions ───────────────────────────────────────────────────
  async function execLens(lensId: string) {
    const lens = LENSES.find((l) => l.id === lensId);
    if (!lens) return;
    activeLensId = lensId;
    activeSql = lens.sql;
    running = true;
    queryError = null;
    try {
      results = await runQuery(lens.sql);
    } catch (e) {
      queryError = e instanceof Error ? e.message : String(e);
    } finally {
      running = false;
    }
  }

  async function execCustomQuery() {
    if (!duckdbState.ready) return;
    activeLensId = null;

    const sql =
      mode === "trend"
        ? buildTrendQuery({ datasetId, metric, country })
        : buildTableQuery({ datasetId, dimension, metric, country: country || undefined });

    activeSql = sql;
    running = true;
    queryError = null;
    try {
      results = await runQuery(sql);
    } catch (e) {
      queryError = e instanceof Error ? e.message : String(e);
    } finally {
      running = false;
    }
  }

  function canRunTrend() {
    return mode !== "trend" || country !== "";
  }
</script>

<div class="qb">
  <!-- Quick-access lens buttons -->
  <div class="lens-bar">
    <span class="lens-label">Quick lenses:</span>
    <div class="lens-buttons">
      {#each LENSES as lens}
        <button
          class="lens-btn"
          class:active={activeLensId === lens.id}
          onclick={() => execLens(lens.id)}
          disabled={!duckdbState.ready || running}
          title={lens.useCaseLabel}
        >
          {lens.icon} {lens.title}
        </button>
      {/each}
    </div>
  </div>

  <!-- Init / error state -->
  {#if !duckdbState.ready && !duckdbState.error}
    <div class="init-overlay">
      <LoadingSpinner />
      <span>Initializing DuckDB-WASM…</span>
    </div>
  {:else if duckdbState.error}
    <div class="error-box">
      <strong>Failed to initialise DuckDB:</strong> {duckdbState.error}
    </div>
  {:else}
    <!-- Main layout -->
    <div class="explorer-layout">
      <!-- Controls panel -->
      <div class="controls-panel">
        <h3 class="panel-title">Build Query</h3>

        <label class="field-label" for="dataset-select">Dataset</label>
        <select id="dataset-select" bind:value={datasetId}>
          {#each DATASET_LIST as ds}
            <option value={ds.id}>{ds.label}</option>
          {/each}
        </select>
        <div class="dataset-meta">
          <DatasetChip domain={currentDataset.domain} />
          <span class="dataset-desc">{currentDataset.description}</span>
        </div>

        <label class="field-label">Mode</label>
        <div class="seg-control">
          <button class:active={mode === "table"} onclick={() => (mode = "table")}>
            Table
          </button>
          <button class:active={mode === "trend"} onclick={() => (mode = "trend")}>
            Trend over time
          </button>
        </div>

        {#if countriesLoaded}
          <label class="field-label" for="country-select">
            Country {mode === "trend" ? "(required)" : "(optional)"}
          </label>
          <select id="country-select" bind:value={country}>
            {#if mode !== "trend"}
              <option value="">All countries</option>
            {/if}
            {#each countries as c}
              <option value={c.code}>{c.name}</option>
            {/each}
          </select>
        {:else if duckdbState.ready}
          <div class="loading-inline"><LoadingSpinner /> Loading countries…</div>
        {/if}

        {#if mode === "table"}
          <label class="field-label" for="dim-select">Group by</label>
          <select id="dim-select" bind:value={dimension}>
            {#each dimensions as d}
              <option value={d.key}>{d.label}</option>
            {/each}
          </select>
        {/if}

        <label class="field-label" for="metric-select">Metric</label>
        <select id="metric-select" bind:value={metric}>
          {#each metrics as m}
            <option value={m.key}>{m.label}</option>
          {/each}
        </select>

        {#if mode === "trend" && !currentDataset.hasTemporal}
          <p class="field-warn">This dataset has no temporal dimension.</p>
        {/if}

        <button
          class="run-btn"
          onclick={execCustomQuery}
          disabled={running || !canRunTrend()}
        >
          {#if running}<LoadingSpinner />{/if}
          {running ? "Running…" : "Run Query"}
        </button>
      </div>

      <!-- Results panel -->
      <div class="results-panel">
        {#if activeLensId}
          {@const lens = LENSES.find((l) => l.id === activeLensId)}
          {#if lens}
            <div class="active-lens">
              <span class="lens-icon">{lens.icon}</span>
              <div>
                <div class="lens-title">{lens.title}</div>
                <div class="lens-sub">{lens.description}</div>
              </div>
              <span class="uc-badge">{lens.useCase}</span>
            </div>
          {/if}
        {/if}

        <div class="result-tabs">
          <button class:active={resultView === "table"} onclick={() => (resultView = "table")}>
            Table
          </button>
          <button class:active={resultView === "chart"} onclick={() => (resultView = "chart")}>
            Chart
          </button>
          <button class:active={resultView === "sql"} onclick={() => (resultView = "sql")}>
            SQL
          </button>
        </div>

        <div class="result-body">
          {#if running}
            <div class="result-state">
              <LoadingSpinner />
              <span>Querying HAPI data via DuckDB… (HTTP range reads)</span>
            </div>
          {:else if queryError}
            <div class="error-box">
              <strong>Query error:</strong> {queryError}
            </div>
          {:else if results.length === 0 && activeSql}
            <div class="result-state empty">No results found.</div>
          {:else if results.length > 0}
            {#if resultView === "table"}
              <ResultTable {results} />
            {:else if resultView === "chart"}
              <ResultChart
                {results}
                isTrend={mode === "trend" || (activeLensId !== null && false)}
                {dimLabel}
                {metricLabel}
              />
            {:else}
              <SqlPreview sql={activeSql} />
            {/if}
          {:else}
            <div class="result-state empty">
              Choose a pre-built lens above, or configure a custom query and click
              <strong>Run Query</strong>.
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .qb {
    font-size: 13px;
  }

  /* ── Lens bar ─────────────────────────────────────────────── */
  .lens-bar {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .lens-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
    padding-top: 0.3rem;
    white-space: nowrap;
  }

  .lens-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .lens-btn {
    font-size: 12px;
    padding: 0.25rem 0.65rem;
    border: 1px solid #ccc;
    border-radius: 999px;
    background: #fff;
    cursor: pointer;
    color: #555;
    transition: border-color 0.1s, background 0.1s;
  }

  .lens-btn:hover:not(:disabled) {
    border-color: #007ce0;
    color: #007ce0;
    background: #f0f7ff;
  }

  .lens-btn.active {
    border-color: #007ce0;
    background: #007ce0;
    color: #fff;
  }

  .lens-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Init/error ───────────────────────────────────────────── */
  .init-overlay {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: #888;
    font-size: 13px;
  }

  .error-box {
    padding: 0.75rem 1rem;
    background: #fce4d6;
    border: 1px solid #f4c0a0;
    border-radius: 4px;
    color: #8b3a0e;
    font-size: 13px;
    margin-bottom: 0.75rem;
  }

  /* ── Explorer layout ──────────────────────────────────────── */
  .explorer-layout {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .controls-panel {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .results-panel {
    flex: 1;
    min-width: 0;
  }

  .panel-title {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 0.25rem;
    color: #333;
  }

  /* ── Form controls ────────────────────────────────────────── */
  .field-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #888;
    margin-top: 0.25rem;
  }

  select {
    width: 100%;
    padding: 0.35rem 0.5rem;
    font-size: 13px;
    border: 1px solid #ccc;
    border-radius: 3px;
    background: #fff;
    color: #333;
    cursor: pointer;
  }

  select:focus {
    outline: 2px solid #007ce055;
    border-color: #007ce0;
  }

  .dataset-meta {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    margin-top: 0.1rem;
  }

  .dataset-desc {
    font-size: 11px;
    color: #888;
    line-height: 1.4;
  }

  .seg-control {
    display: flex;
    border: 1px solid #ccc;
    border-radius: 3px;
    overflow: hidden;
  }

  .seg-control button {
    flex: 1;
    padding: 0.3rem 0.5rem;
    font-size: 12px;
    border: none;
    background: #fff;
    cursor: pointer;
    color: #555;
  }

  .seg-control button + button {
    border-left: 1px solid #ccc;
  }

  .seg-control button.active {
    background: #007ce0;
    color: #fff;
  }

  .field-warn {
    font-size: 11px;
    color: #c47a00;
    background: #fff8e1;
    border: 1px solid #ffe082;
    border-radius: 3px;
    padding: 0.3rem 0.5rem;
    margin: 0;
  }

  .loading-inline {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 12px;
    color: #888;
  }

  .run-btn {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    background: #007ce0;
    color: #fff;
    border: none;
    border-radius: 3px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .run-btn:hover:not(:disabled) {
    background: #005fac;
  }

  .run-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Active lens header ───────────────────────────────────── */
  .active-lens {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    background: #f0f7ff;
    border: 1px solid #c8e0f8;
    border-radius: 4px;
    margin-bottom: 0.75rem;
  }

  .lens-icon {
    font-size: 1.3rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .lens-title {
    font-weight: 700;
    font-size: 13px;
    color: #1a5276;
  }

  .lens-sub {
    font-size: 12px;
    color: #555;
    margin-top: 0.1rem;
  }

  .uc-badge {
    margin-left: auto;
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: #007ce0;
    background: #fff;
    border: 1px solid #007ce0;
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
  }

  /* ── Result tabs ──────────────────────────────────────────── */
  .result-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid #ccc;
    margin-bottom: 0.75rem;
  }

  .result-tabs button {
    padding: 0.4rem 0.9rem;
    font-size: 12px;
    border: 1px solid transparent;
    border-bottom: none;
    background: transparent;
    cursor: pointer;
    color: #888;
    border-radius: 3px 3px 0 0;
    margin-bottom: -1px;
  }

  .result-tabs button.active {
    background: #fff;
    border-color: #ccc;
    color: #333;
    font-weight: 600;
  }

  .result-tabs button:hover:not(.active) {
    color: #333;
  }

  /* ── Result states ────────────────────────────────────────── */
  .result-state {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem 1rem;
    color: #888;
    font-size: 13px;
  }

  .result-state.empty {
    color: #aaa;
  }

  .result-body {
    min-height: 120px;
  }

  /* ── Responsive ───────────────────────────────────────────── */
  @media (max-width: 700px) {
    .explorer-layout {
      flex-direction: column;
    }

    .controls-panel {
      width: 100%;
    }
  }
</style>
