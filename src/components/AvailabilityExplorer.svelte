<script lang="ts">
  import {
    fetchAvailabilityMatrix,
    fetchSubNationalAvailability,
    type AvailabilityRow,
  } from "../lib/hapi.js";

  const DATASET_LABELS: Record<string, string> = {
    idps: "IDPs",
    "humanitarian-needs": "Hum. Needs",
    "refugees-persons-of-concern": "Refugees",
    returnees: "Returnees",
    rainfall: "Rainfall",
    "conflict-events": "Conflict",
    funding: "Funding",
    "national-risk": "Nat. Risk",
    "operational-presence": "Org Presence",
    "food-prices-market-monitor": "Food Prices",
    "food-security": "Food Sec.",
    "poverty-rate": "Poverty",
    "baseline-population": "Population",
  };

  const CATEGORY_LABELS: Record<string, string> = {
    "affected-people": "Affected People",
    climate: "Climate",
    "coordination-context": "Coordination",
    "food-security-nutrition-poverty": "Food & Poverty",
    "geography-infrastructure": "Geography",
    metadata: "Metadata",
  };

  let rows: AvailabilityRow[] = $state([]);
  let loading = $state(true);
  let loadingSubNational = $state(false);
  let error: string | null = $state(null);
  let search = $state("");
  let expandedCode: string | null = $state(null);
  let theme: "dark" | "light" = $state("light");

  $effect(() => {
    document.documentElement.dataset.theme = theme;
  });

  $effect(() => {
    fetchAvailabilityMatrix()
      .then((level0Rows) => {
        rows = level0Rows;
        loading = false;

        // Phase 2: check & load sub-national in background
        const codes = [...new Set(level0Rows.map((r) => r.locationCode))];
        loadingSubNational = true;
        Promise.all([
          fetchSubNationalAvailability(codes, 1),
          fetchSubNationalAvailability(codes, 2),
        ])
          .then(([r1, r2]) => {
            rows = [...level0Rows, ...r1, ...r2];
            loadingSubNational = false;
          })
          .catch(() => {
            loadingSubNational = false;
          });
      })
      .catch((e) => {
        error = String(e);
        loading = false;
      });
  });

  // Unique datasets in stable order
  const datasets = $derived.by(() => {
    const seen = new Map<string, { category: string; subcategory: string }>();
    for (const r of rows) {
      const key = `${r.category}/${r.subcategory}`;
      if (!seen.has(key)) seen.set(key, { category: r.category, subcategory: r.subcategory });
    }
    return [...seen.values()].sort((a, b) =>
      a.category !== b.category
        ? a.category.localeCompare(b.category)
        : a.subcategory.localeCompare(b.subcategory),
    );
  });

  // Unique countries filtered by search
  const countries = $derived.by(() => {
    const q = search.toLowerCase();
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (!seen.has(r.locationCode)) seen.set(r.locationCode, r.locationName);
    }
    return [...seen.entries()]
      .map(([code, name]) => ({ code, name }))
      .filter(
        ({ name, code }) =>
          !q || name.toLowerCase().includes(q) || code.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  // matrix[locationCode][category/subcategory] = { levels: Set<number>, dates: Map<number,string> }
  const matrix = $derived.by(() => {
    const m = new Map<string, Map<string, { levels: Set<number>; dates: Map<number, string> }>>();
    for (const r of rows) {
      let inner = m.get(r.locationCode);
      if (!inner) {
        inner = new Map();
        m.set(r.locationCode, inner);
      }
      const key = `${r.category}/${r.subcategory}`;
      let cell = inner.get(key);
      if (!cell) {
        cell = { levels: new Set(), dates: new Map() };
        inner.set(key, cell);
      }
      cell.levels.add(r.adminLevel);
      if (r.latestDate) cell.dates.set(r.adminLevel, r.latestDate);
    }
    return m;
  });

  const categoryGroups = $derived.by(() => {
    const groups: { category: string; count: number }[] = [];
    let last = "";
    for (const d of datasets) {
      if (d.category !== last) {
        groups.push({ category: d.category, count: 1 });
        last = d.category;
      } else {
        groups[groups.length - 1].count++;
      }
    }
    return groups;
  });

  const totalCountries = $derived(new Set(rows.map((r) => r.locationCode)).size);
  const totalDatasets = $derived(datasets.length);
  const totalEntries = $derived(rows.length);
</script>

<div class="avail-page" class:dark={theme === "dark"}>
  <header class="page-header">
    <div class="header-left">
      <a href="/" class="back-link">← HDX Lens</a>
      <h1 class="page-title">Data Availability</h1>
    </div>
    <div class="header-right">
      {#if !loading && !error}
        <span class="summary-stat">
          {totalCountries} countries · {totalDatasets} datasets · {totalEntries.toLocaleString()} entries
          {#if loadingSubNational}<span class="sub-loading">· checking sub-national…</span>{/if}
        </span>
      {/if}
      <input
        class="search-box"
        type="search"
        placeholder="Search countries…"
        bind:value={search}
        aria-label="Search countries"
      />
      <button
        class="theme-toggle"
        class:dark={theme === "dark"}
        onclick={() => (theme = theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
        <span class="toggle-label">{theme === "dark" ? "Dark" : "Light"}</span>
      </button>
    </div>
  </header>

  {#if loading}
    <div class="status-overlay">
      <div class="spinner"></div>
      <p>Loading catalog…</p>
    </div>
  {:else if error}
    <div class="status-overlay error">
      <p>Failed to load data availability</p>
      <pre>{error}</pre>
    </div>
  {:else}
    <div class="table-wrap">
      <table class="avail-table">
        <thead>
          <tr class="group-row">
            <th class="country-col sticky-col" rowspan="2">Country</th>
            {#each categoryGroups as g (g.category)}
              <th class="group-header" colspan={g.count}
                >{CATEGORY_LABELS[g.category] ?? g.category}</th
              >
            {/each}
          </tr>
          <tr class="dataset-row">
            {#each datasets as d (`${d.category}/${d.subcategory}`)}
              <th class="dataset-col" title={`${d.category} / ${d.subcategory}`}>
                {DATASET_LABELS[d.subcategory] ?? d.subcategory}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each countries as c (c.code)}
            {@const countryData = matrix.get(c.code)}
            <tr
              class="country-row"
              class:expanded={expandedCode === c.code}
              onclick={() => (expandedCode = expandedCode === c.code ? null : c.code)}
            >
              <td class="country-name sticky-col">
                <span class="expand-icon">{expandedCode === c.code ? "▾" : "▸"}</span>
                {c.name}
                <span class="code-badge">{c.code}</span>
              </td>
              {#each datasets as d (`${d.category}/${d.subcategory}`)}
                {@const cell = countryData?.get(`${d.category}/${d.subcategory}`)}
                <td class="cell">
                  {#if cell}
                    <span class="dots">
                      <span
                        class="dot"
                        class:filled={cell.levels.has(0)}
                        title={cell.dates.get(0)
                          ? `National · updated ${cell.dates.get(0)!.slice(0, 10)}`
                          : "National"}
                      ></span>
                      <span
                        class="dot"
                        class:filled={cell.levels.has(1)}
                        class:pending={loadingSubNational && !cell.levels.has(1)}
                        title={cell.dates.get(1)
                          ? `Sub-national · updated ${cell.dates.get(1)!.slice(0, 10)}`
                          : "Sub-national"}
                      ></span>
                      <span
                        class="dot"
                        class:filled={cell.levels.has(2)}
                        class:pending={loadingSubNational && !cell.levels.has(2)}
                        title={cell.dates.get(2)
                          ? `District · updated ${cell.dates.get(2)!.slice(0, 10)}`
                          : "District"}
                      ></span>
                    </span>
                  {:else}
                    <span class="no-data">—</span>
                  {/if}
                </td>
              {/each}
            </tr>
            {#if expandedCode === c.code}
              <tr class="detail-row">
                <td class="detail-country sticky-col">
                  <div class="detail-levels">
                    <span class="dot filled small"></span> National
                    <span class="dot filled small"></span> Sub-national
                    <span class="dot filled small"></span> District
                  </div>
                </td>
                {#each datasets as d (`${d.category}/${d.subcategory}`)}
                  {@const cell = countryData?.get(`${d.category}/${d.subcategory}`)}
                  <td class="detail-cell">
                    {#if cell}
                      <div class="detail-dates">
                        {#each [0, 1, 2] as lvl}
                          {#if cell.dates.has(lvl)}
                            <span class="detail-date">{cell.dates.get(lvl)!.slice(0, 10)}</span>
                          {:else}
                            <span class="detail-date empty">—</span>
                          {/if}
                        {/each}
                      </div>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    <footer class="legend">
      <span class="dots">
        <span class="dot filled"></span>
        <span class="dot filled"></span>
        <span class="dot filled"></span>
      </span>
      <span>three dots = national / sub-national / district level</span>
      <span class="legend-sep">·</span>
      <span class="dot filled"></span> filled = data present
      <span class="legend-sep">·</span>
      <span class="dot"></span> hollow = not in catalog
      <span class="legend-sep">·</span>
      <span class="legend-note">hover dots for update date · click row for details</span>
    </footer>
  {/if}
</div>

<style>
  .avail-page {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    color: var(--text);
    font-family: system-ui, sans-serif;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 1px solid var(--text-sep);
    flex-shrink: 0;
    gap: 16px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .back-link {
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    white-space: nowrap;
  }
  .back-link:hover {
    color: var(--text);
  }

  .page-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    white-space: nowrap;
  }

  .summary-stat {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .sub-loading {
    font-style: italic;
    opacity: 0.7;
  }

  .search-box {
    padding: 5px 10px;
    border: 1px solid var(--text-sep);
    border-radius: 4px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    width: 180px;
  }
  .search-box:focus {
    outline: none;
    border-color: #f46d43;
  }

  .status-overlay {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-muted);
  }

  .status-overlay.error {
    color: var(--error-text);
  }

  .status-overlay pre {
    font-size: 12px;
    max-width: 500px;
    white-space: pre-wrap;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--spinner-track);
    border-top-color: #f46d43;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .table-wrap {
    flex: 1;
    overflow: auto;
    position: relative;
  }

  .avail-table {
    border-collapse: collapse;
    font-size: 12px;
    white-space: nowrap;
    width: 100%;
  }

  .avail-table thead {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg);
  }

  .sticky-col {
    position: sticky;
    left: 0;
    background: var(--bg);
    z-index: 5;
  }

  thead .sticky-col {
    z-index: 15;
  }

  .group-row th,
  .dataset-row th {
    padding: 6px 8px;
    border-bottom: 1px solid var(--text-sep);
    font-weight: 600;
    color: var(--text-muted);
    text-align: center;
  }

  .group-header {
    border-left: 1px solid var(--text-sep);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--bg);
  }

  .dataset-col {
    font-size: 11px;
    border-left: 1px solid var(--text-sep);
    min-width: 60px;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .country-col {
    text-align: left;
    min-width: 200px;
    border-right: 1px solid var(--text-sep);
  }

  .country-row {
    cursor: pointer;
    transition: background 0.1s;
  }

  .country-row:hover,
  .country-row.expanded {
    background: var(--hover-bg);
  }

  .country-row.expanded .sticky-col {
    background: var(--hover-bg);
  }

  .country-name {
    padding: 6px 10px;
    border-right: 1px solid var(--text-sep);
    user-select: none;
    min-width: 200px;
  }

  .expand-icon {
    font-size: 10px;
    color: var(--text-muted);
    margin-right: 4px;
  }

  .code-badge {
    margin-left: 6px;
    font-size: 10px;
    color: var(--text-muted);
    font-variant: tabular-nums;
  }

  .cell {
    text-align: center;
    padding: 4px 6px;
    border-left: 1px solid var(--text-sep);
    vertical-align: middle;
  }

  .dots {
    display: inline-flex;
    gap: 3px;
    align-items: center;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    border: 1.5px solid var(--text-muted);
    display: inline-block;
    opacity: 0.3;
    flex-shrink: 0;
  }

  .dot.small {
    width: 6px;
    height: 6px;
  }

  .dot.filled {
    background: #27ae60;
    border-color: #27ae60;
    opacity: 0.85;
  }

  .dot.pending {
    opacity: 0.15;
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.15;
    }
    50% {
      opacity: 0.35;
    }
  }

  .no-data {
    color: var(--text-muted);
    opacity: 0.35;
  }

  .detail-row td {
    background: var(--hover-bg);
    border-top: none;
  }

  .detail-country {
    padding: 4px 10px 8px;
    border-right: 1px solid var(--text-sep);
  }

  .detail-levels {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
  }

  .detail-cell {
    text-align: center;
    padding: 2px 6px 8px;
    border-left: 1px solid var(--text-sep);
    vertical-align: top;
  }

  .detail-dates {
    display: flex;
    flex-direction: column;
    gap: 1px;
    align-items: center;
  }

  .detail-date {
    font-size: 10px;
    color: var(--text-muted);
    font-variant: tabular-nums;
    line-height: 1.4;
  }

  .detail-date.empty {
    opacity: 0.3;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    font-size: 11px;
    color: var(--text-muted);
    border-top: 1px solid var(--text-sep);
    flex-shrink: 0;
  }

  .legend-sep {
    color: var(--text-sep);
  }

  .legend-note {
    font-style: italic;
  }

  /* Theme toggle */
  .theme-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 12px;
    transition: background 0.15s;
  }
  .theme-toggle:hover {
    background: var(--hover-bg);
  }
  .toggle-track {
    width: 28px;
    height: 16px;
    background: var(--text-sep);
    border-radius: 8px;
    position: relative;
    transition: background 0.2s;
  }
  .theme-toggle.dark .toggle-track {
    background: #f46d43;
  }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
  }
  .theme-toggle.dark .toggle-thumb {
    transform: translateX(12px);
  }
  .toggle-label {
    font-size: 11px;
  }
</style>
