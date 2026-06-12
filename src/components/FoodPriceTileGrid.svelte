<script lang="ts">
  import { fetchFoodPriceGlobal, type FoodPriceCountryRow } from "../lib/hapi.js";

  let { theme, onSelect }: { theme: "dark" | "light"; onSelect: (code: string) => void } = $props();

  let rows = $state<FoodPriceCountryRow[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetchFoodPriceGlobal()
      .then((r) => { rows = r; loading = false; })
      .catch((e) => { error = String(e); loading = false; });
  });

  function sparklinePath(values: number[], w: number, h: number): string {
    if (values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    // Show last 36 months max
    const slice = values.length > 36 ? values.slice(-36) : values;
    const pts = slice.map((v, i) => {
      const x = (i / (slice.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(" L ")}`;
  }

  function fmtPeriod(p: string): string {
    if (!p) return "";
    const [y, m] = p.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m, 10) - 1] ?? m} ${y}`;
  }
</script>

<div class="tile-grid-wrap" class:dark={theme === "dark"}>
  <div class="tile-header">
    <h2>Food price trends by country</h2>
    <span class="sub">Composite price index (base=100 at first data point) · sorted by 12-month change · click to explore</span>
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
        {@const sparkVals = row.byMonth.map((m) => m.index)}
        {@const sparkPath = sparklinePath(sparkVals, 120, 36)}
        {@const rising = (row.change12m ?? 0) > 0}
        {@const sparkColor = rising ? "#e74c3c" : "#27ae60"}
        <button class="tile" onclick={() => onSelect(row.code)}>
          <div class="tile-name">{row.name}</div>

          {#if sparkPath}
            <svg class="sparkline" viewBox="0 0 120 36" preserveAspectRatio="none"
              style="color: {sparkColor}">
              <path d={sparkPath} stroke="currentColor" stroke-width="1.5" fill="none" />
            </svg>
          {:else}
            <div class="sparkline-empty"></div>
          {/if}

          <div class="stats">
            {#if row.latestIndex != null}
              <div class="stat-row">
                <span class="stat-label">Index</span>
                <span class="stat-val">{row.latestIndex.toFixed(0)}</span>
              </div>
            {/if}

            {#if row.change12m != null}
              <div class="stat-row">
                <span class="stat-label">12-month</span>
                <span class="stat-val {rising ? 'up' : 'down'}">
                  {row.change12m >= 0 ? "+" : ""}{row.change12m.toFixed(1)} pts
                </span>
              </div>
            {/if}

            {#if row.earliestPeriod && row.latestPeriod}
              <div class="stat-row date-row">
                <span class="stat-label">{fmtPeriod(row.earliestPeriod)} – {fmtPeriod(row.latestPeriod)}</span>
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
    border-color: #5470c6;
    box-shadow: 0 2px 8px rgba(84, 112, 198, 0.15);
  }
  .dark .tile {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
  }
  .dark .tile:hover {
    border-color: #5470c6;
    box-shadow: 0 2px 8px rgba(84, 112, 198, 0.2);
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
  .stat-val.up { color: #e74c3c; }
  .stat-val.down { color: #27ae60; }

  .date-row {
    opacity: 0.6;
  }
  .date-row .stat-label {
    font-size: 9px;
  }

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
