<script lang="ts">
  import { fetchCrisisTimelineGlobal, type CrisisCountryRow } from "../lib/hapi.js";

  let { theme, onSelect }: { theme: "dark" | "light"; onSelect: (code: string) => void } = $props();

  let rows = $state<CrisisCountryRow[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetchCrisisTimelineGlobal()
      .then((r) => { rows = r; loading = false; })
      .catch((e) => { error = String(e); loading = false; });
  });

  function sparklinePath(values: number[], w: number, h: number): string {
    if (values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(" L ")}`;
  }

  function fmtNum(v: number): string {
    if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
    return v.toFixed(0);
  }

  function fmtChange(v: number | null, unit: "%" | "pp"): string {
    if (v == null) return "";
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(unit === "pp" ? 1 : 0)}${unit}`;
  }

  function changeClass(v: number | null): string {
    if (v == null) return "";
    return v > 0 ? "up" : v < 0 ? "down" : "";
  }
</script>

<div class="tile-grid-wrap" class:dark={theme === "dark"}>
  <div class="tile-header">
    <h2>Crisis indicators by country</h2>
    <span class="sub">Sorted by IPC Phase 3+ change · click a country to view full timeline</span>
  </div>

  {#if loading}
    <div class="skeleton-grid">
      {#each { length: 12 } as _}
        <div class="skeleton-tile"></div>
      {/each}
    </div>
  {:else if error}
    <div class="err">Failed to load global data: {error}</div>
  {:else if rows.length === 0}
    <div class="err">No data available.</div>
  {:else}
    <div class="tile-grid">
      {#each rows as row}
        {@const sparkVals = row.ipcByPeriod.length >= 2
          ? row.ipcByPeriod.map((p) => p.phase3plus)
          : row.conflictByYear.map((p) => p.fatalities)}
        {@const sparkPath = sparklinePath(sparkVals, 120, 36)}
        {@const hasIpc = row.latestIpc != null}
        <button class="tile" onclick={() => onSelect(row.code)}>
          <div class="tile-name">{row.name}</div>

          {#if sparkPath}
            <svg class="sparkline" viewBox="0 0 120 36" preserveAspectRatio="none"
              style="color: {hasIpc ? '#eb943b' : '#e74c3c'}">
              <path d={sparkPath} stroke="currentColor" stroke-width="1.5" fill="none" />
            </svg>
          {:else}
            <div class="sparkline-empty"></div>
          {/if}

          <div class="stats">
            {#if row.latestFatalities != null}
              <div class="stat-row">
                <span class="stat-label">Fatalities</span>
                <span class="stat-val">
                  {fmtNum(row.latestFatalities)}
                  {#if row.fatalitiesChangePct != null}
                    <span class="change {changeClass(row.fatalitiesChangePct)}">{fmtChange(row.fatalitiesChangePct, "%")}</span>
                  {/if}
                </span>
              </div>
            {/if}

            {#if row.latestIdps != null}
              <div class="stat-row">
                <span class="stat-label">IDPs</span>
                <span class="stat-val">
                  {fmtNum(row.latestIdps)}
                  {#if row.idpsChangePct != null}
                    <span class="change {changeClass(row.idpsChangePct)}">{fmtChange(row.idpsChangePct, "%")}</span>
                  {/if}
                </span>
              </div>
            {/if}

            {#if row.latestIpc != null}
              <div class="stat-row">
                <span class="stat-label">Phase 3+</span>
                <span class="stat-val ipc">
                  {row.latestIpc.toFixed(1)}%
                  {#if row.ipcChangePp != null}
                    <span class="change {changeClass(row.ipcChangePp)}">{fmtChange(row.ipcChangePp, "pp")}</span>
                  {/if}
                </span>
              </div>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tile-grid-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 16px 18px;
    color: var(--text);
  }

  .tile-header {
    margin-bottom: 14px;
  }
  .tile-header h2 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 2px;
    color: var(--text);
  }
  .tile-header .sub {
    font-size: 11px;
    color: var(--text-muted);
  }

  .tile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: var(--bg);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: system-ui, sans-serif;
    color: var(--text);
  }
  .tile:hover {
    border-color: #eb943b;
    box-shadow: 0 2px 8px rgba(235, 148, 59, 0.15);
  }
  .dark .tile {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
  }
  .dark .tile:hover {
    border-color: #eb943b;
    box-shadow: 0 2px 8px rgba(235, 148, 59, 0.2);
  }

  .tile-name {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text);
  }

  .sparkline {
    width: 100%;
    height: 36px;
    display: block;
    opacity: 0.85;
  }
  .sparkline-empty {
    height: 36px;
  }

  .stats {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 4px;
    font-size: 10px;
  }

  .stat-label {
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .stat-val {
    font-size: 11px;
    font-weight: 500;
    color: var(--text);
    text-align: right;
  }
  .stat-val.ipc {
    color: #eb943b;
  }

  .change {
    font-size: 9px;
    font-weight: 400;
    margin-left: 3px;
  }
  .change.up { color: #e74c3c; }
  .change.down { color: #27ae60; }

  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
  }

  .skeleton-tile {
    height: 110px;
    border-radius: 8px;
    background: linear-gradient(90deg, var(--hover-bg) 25%, rgba(0,0,0,0.05) 50%, var(--hover-bg) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }
  .dark .skeleton-tile {
    background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.05) 75%);
    background-size: 200% 100%;
  }
  @keyframes shimmer { to { background-position: -200% 0; } }

  .err {
    color: var(--error-text, #c0392b);
    font-size: 13px;
    padding: 24px;
    text-align: center;
  }
</style>
