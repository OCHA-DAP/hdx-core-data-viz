<script lang="ts">
  import { fetchIpcPhases, type IpcPhaseRow } from "../lib/hapi.js";

  // slider goes 2017–2027; 2027 = "Latest per country" (year=null)
  const YEAR_MIN = 2017;
  const YEAR_LATEST = 2027; // sentinel value for the slider's rightmost tick
  let sliderVal = $state(YEAR_LATEST);
  const year = $derived(sliderVal === YEAR_LATEST ? null : sliderVal);
  type SortKey = "p5" | "p4plus" | "p3plus";
  let sortBy = $state<SortKey>("p5");
  let rows = $state<IpcPhaseRow[]>([]);
  let hasData = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let theme = $state<"dark" | "light">("light");

  $effect(() => { document.documentElement.dataset.theme = theme; });

  $effect(() => {
    const y = year;
    let cancelled = false;
    loading = true;
    error = null;
    fetchIpcPhases(y)
      .then((r) => {
        if (!cancelled) { rows = r; hasData = r.length > 0; loading = false; }
      })
      .catch((e) => { if (!cancelled) { error = String(e); loading = false; } });
    return () => { cancelled = true; };
  });

  interface CountryPhases {
    name: string;
    code: string;
    year: number;
    p1: number; p2: number; p3: number; p4: number; p5: number;
    phase3plus: number;
    phase4plus: number;
    total: number;
  }

  const countries = $derived((): CountryPhases[] => {
    const byCode = new Map<string, CountryPhases>();
    for (const r of rows) {
      if (!byCode.has(r.locationCode)) {
        byCode.set(r.locationCode, {
          name: r.locationName, code: r.locationCode, year: r.year,
          p1: 0, p2: 0, p3: 0, p4: 0, p5: 0,
          phase3plus: 0, phase4plus: 0, total: 0,
        });
      }
      const c = byCode.get(r.locationCode)!;
      const f = Math.max(0, r.fraction);
      if (r.phase === "1") c.p1 = f;
      if (r.phase === "2") c.p2 = f;
      if (r.phase === "3") c.p3 = f;
      if (r.phase === "4") c.p4 = f;
      if (r.phase === "5") c.p5 = f;
    }
    for (const c of byCode.values()) {
      c.phase3plus = c.p3 + c.p4 + c.p5;
      c.phase4plus = c.p4 + c.p5;
      c.total = c.p1 + c.p2 + c.p3 + c.p4 + c.p5;
    }
    const list = [...byCode.values()];
    if (sortBy === "p5")
      return list.sort((a, b) => b.p5 - a.p5 || b.p4 - a.p4 || b.p3 - a.p3 || b.p2 - a.p2 || b.p1 - a.p1);
    if (sortBy === "p4plus")
      return list.sort((a, b) => b.phase4plus - a.phase4plus || b.p5 - a.p5 || b.p3 - a.p3 || b.p2 - a.p2 || b.p1 - a.p1);
    return list.sort((a, b) => b.phase3plus - a.phase3plus || b.phase4plus - a.phase4plus || b.p5 - a.p5 || b.p2 - a.p2 || b.p1 - a.p1);
  });

  const PHASE_COLORS = ["#5d0000", "#cb2a1e", "#eb943b", "#f2e671", "#c9e2bc"];
  const PHASE_LABELS = ["Phase 5 – Famine", "Phase 4 – Emergency", "Phase 3 – Crisis", "Phase 2 – Stressed", "Phase 1 – Minimal"];

  function pct(f: number): string { return (Math.min(1, f) * 100).toFixed(1) + "%"; }

  function rowTitle(c: CountryPhases): string {
    return [
      `Phase 1: ${pct(c.p1)}`,
      `Phase 2: ${pct(c.p2)}`,
      `Phase 3: ${pct(c.p3)}`,
      `Phase 4: ${pct(c.p4)}`,
      `Phase 5: ${pct(c.p5)}`,
      `Phase 3+: ${pct(c.phase3plus)}`,
      `(${c.year})`,
    ].join(" · ");
  }
</script>

<div class="wrapper">
  <nav class="topbar" class:dark={theme === "dark"}>
    <div class="year-ctrl">
      <button class="step-btn" onclick={() => sliderVal = Math.max(YEAR_MIN, sliderVal - 1)} disabled={sliderVal <= YEAR_MIN}>◀</button>
      <input
        class="year-slider"
        type="range" min={YEAR_MIN} max={YEAR_LATEST} step={1}
        bind:value={sliderVal}
      />
      <button class="step-btn" onclick={() => sliderVal = Math.min(YEAR_LATEST, sliderVal + 1)} disabled={sliderVal >= YEAR_LATEST}>▶</button>
      <span class="year-label">{sliderVal === YEAR_LATEST ? "Latest" : sliderVal}</span>
    </div>

    <div class="ctrl-group">
      <span class="ctrl-label">Sort</span>
      <div class="seg-group">
        <button class="seg-opt" class:active={sortBy === "p5"}     onclick={() => sortBy = "p5"}>5</button>
        <button class="seg-opt" class:active={sortBy === "p4plus"} onclick={() => sortBy = "p4plus"}>4+</button>
        <button class="seg-opt" class:active={sortBy === "p3plus"} onclick={() => sortBy = "p3plus"}>3+</button>
      </div>
    </div>

    {#if hasData}
      <span class="stat">{countries().length} countries with IPC data</span>
    {/if}

    <div class="legend">
      {#each PHASE_COLORS as color, i}
        <span class="legend-chip">
          <span class="swatch" style="background: {color}"></span>
          <span class="legend-label">{PHASE_LABELS[i]}</span>
        </span>
      {/each}
    </div>

    <button
      class="theme-toggle"
      class:dark={theme === "dark"}
      onclick={() => (theme = theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
      <span class="toggle-label">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  </nav>

  <div class="chart-area">
    {#if loading}
      <div class="overlay"><div class="spinner"></div><p>Loading IPC phase data…</p></div>
    {:else if error}
      <div class="overlay error"><p>Failed to load data</p><pre>{error}</pre></div>
    {:else if !hasData}
      <div class="overlay"><p>No IPC food security data for {year ?? "any year"}.</p></div>
    {:else}
      <div class="bars-scroll">
        <div class="bars">
          {#each countries() as c (c.code)}
            <div class="row" title={rowTitle(c)}>
              <span class="cname">{c.name}</span>
              <div class="bar">
                {#if c.p5 > 0.002}
                  <div class="seg" style="width:{Math.min(100,(c.p5*100)).toFixed(2)}%; background:#5d0000"></div>
                {/if}
                {#if c.p4 > 0.002}
                  <div class="seg" style="width:{Math.min(100,(c.p4*100)).toFixed(2)}%; background:#cb2a1e"></div>
                {/if}
                {#if c.p3 > 0.002}
                  <div class="seg" style="width:{Math.min(100,(c.p3*100)).toFixed(2)}%; background:#eb943b"></div>
                {/if}
                {#if c.p2 > 0.002}
                  <div class="seg" style="width:{Math.min(100,(c.p2*100)).toFixed(2)}%; background:#f2e671"></div>
                {/if}
                {#if c.p1 > 0.002}
                  <div class="seg" style="width:{Math.min(100,(c.p1*100)).toFixed(2)}%; background:#c9e2bc"></div>
                {/if}
              </div>
              <span
                class="pct-label"
                class:high={(sortBy === "p5" ? c.p5 : sortBy === "p4plus" ? c.phase4plus : c.phase3plus) > 0.1}
                class:critical={(sortBy === "p5" ? c.p5 : sortBy === "p4plus" ? c.phase4plus : c.phase3plus) > 0.25}
              >
                {sortBy === "p5" ? pct(c.p5) : sortBy === "p4plus" ? pct(c.phase4plus) : pct(c.phase3plus)}
              </span>
              {#if c.year !== year}
                <span class="year-tag">{c.year}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
      <p class="hint">
        IPC (Integrated Food Security Phase Classification) · hover a row for phase details
      </p>
    {/if}
  </div>
</div>

<style>
  .wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    color: var(--text);
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 18px;
    flex-shrink: 0;
    flex-wrap: wrap;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    font-size: 12px;
  }
  .topbar.dark { border-bottom-color: rgba(255, 255, 255, 0.08); }

  .ctrl-group { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .ctrl-label { color: var(--text-muted); white-space: nowrap; }

  .seg-group { display: flex; border: 1px solid rgba(0,0,0,0.15); border-radius: 4px; overflow: hidden; }
  .seg-opt {
    background: none; border: none; border-left: 1px solid rgba(0,0,0,0.15);
    padding: 2px 8px; font-size: 11px; cursor: pointer; color: var(--text-muted);
    transition: background 0.1s, color 0.1s;
  }
  .seg-opt:first-child { border-left: none; }
  .seg-opt:hover { background: var(--hover-bg); }
  .seg-opt.active { background: #f46d43; color: white; }

  .year-ctrl {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .year-slider {
    width: 160px;
    height: 6px;
    accent-color: #f46d43;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
  }
  .year-slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: var(--spinner-track, rgba(0, 0, 0, 0.12));
  }
  .year-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #f46d43;
    margin-top: -6px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  }
  .year-slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--spinner-track, rgba(0, 0, 0, 0.12));
  }
  .year-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #f46d43;
    border: none;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  }

  .year-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    min-width: 36px;
    text-align: center;
  }

  .step-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 11px;
    border-radius: 3px;
  }
  .step-btn:disabled { opacity: 0.3; cursor: default; }
  .step-btn:not(:disabled):hover { color: var(--text); background: var(--hover-bg); }

  .ctrl-group select {
    font-size: 12px;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.15);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
  }
  .topbar.dark .ctrl-group select {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
    color: #ddd;
  }

  .stat { font-size: 12px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

  .legend {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .legend-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    font-size: 11px;
    color: var(--text-muted);
  }

  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    display: inline-block;
    flex-shrink: 0;
  }

  .legend-label { font-size: 10px; }

  .theme-toggle {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 12px;
    padding: 4px 2px;
    transition: color 0.15s;
    flex-shrink: 0;
  }
  .theme-toggle:hover { color: var(--text); }

  .toggle-track {
    position: relative;
    width: 36px;
    height: 20px;
    background: #ccc;
    border-radius: 10px;
    transition: background 0.25s;
    flex-shrink: 0;
  }
  .dark .toggle-track { background: #f46d43; }
  .toggle-thumb {
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    top: 2px;
    left: 2px;
    transition: transform 0.25s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }
  .dark .toggle-thumb { transform: translateX(16px); }
  .toggle-label { min-width: 28px; }

  .chart-area {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .bars-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 20px 12px;
  }

  .bars { display: flex; flex-direction: column; gap: 3px; }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 22px;
    min-height: 22px;
  }
  .row:hover .bar { opacity: 0.85; }

  .cname {
    width: 150px;
    min-width: 150px;
    font-size: 12px;
    color: var(--text);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .bar {
    flex: 1;
    height: 16px;
    display: flex;
    border-radius: 2px;
    overflow: hidden;
    background: var(--hover-bg);
    transition: opacity 0.1s;
  }

  .seg { height: 100%; }

  .pct-label {
    width: 40px;
    min-width: 40px;
    font-size: 11px;
    color: var(--text-muted);
    text-align: right;
    flex-shrink: 0;
  }
  .pct-label.high { color: #eb943b; font-weight: 500; }
  .pct-label.critical { color: #cb2a1e; font-weight: 600; }

  .year-tag {
    font-size: 10px;
    color: var(--text-sep);
    flex-shrink: 0;
    min-width: 30px;
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-muted);
    font-size: 14px;
    z-index: 1;
  }
  .overlay.error pre {
    font-size: 12px;
    color: var(--error-text);
    max-width: 600px;
    overflow: auto;
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
  @keyframes spin { to { transform: rotate(360deg); } }

  .hint {
    flex-shrink: 0;
    text-align: center;
    font-size: 11px;
    color: var(--text-sep);
    pointer-events: none;
    white-space: nowrap;
    padding: 6px 0 8px;
    margin: 0;
  }
</style>
