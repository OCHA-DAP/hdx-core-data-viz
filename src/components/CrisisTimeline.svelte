<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as echarts from "echarts";
  import CrisisTileGrid from "./CrisisTileGrid.svelte";
  import {
    fetchCountryList,
    fetchCrisisTimeline,
    type CountryRow,
    type TimelinePoint,
  } from "../lib/hapi.js";
  import { readParams, updateParams, pushParams } from "../lib/urlState.js";

  const _p = readParams();
  const _initCountry = _p.get("country") ?? "";

  let countries = $state<CountryRow[]>([]);
  let locationCode = $state(_initCountry);
  let rows = $state<TimelinePoint[]>([]);
  let hasData = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let theme = $state<"dark" | "light">(localStorage.getItem("theme") === "dark" ? "dark" : "light");
  let el = $state<HTMLDivElement>();
  let chart: echarts.ECharts | undefined;

  // showGrid: true = global tile view; false = country detail view
  let showGrid = $state(!_initCountry);

  $effect(() => {
    updateParams({
      country: locationCode || null,
      detail: !showGrid && locationCode ? "true" : null,
    });
  });

  let _popstate: () => void;
  onMount(() => { _popstate = () => location.reload(); window.addEventListener("popstate", _popstate); });

  $effect(() => { document.documentElement.dataset.theme = theme; });

  $effect(() => {
    fetchCountryList().then((list) => {
      countries = list.filter((c) => c.hasHrp || c.inGho);
    });
  });

  $effect(() => {
    const code = locationCode;
    if (!code) { rows = []; hasData = false; return; }
    let cancelled = false;
    loading = true;
    hasData = false;
    error = null;
    fetchCrisisTimeline(code)
      .then((r) => {
        if (!cancelled) { rows = r; loading = false; hasData = r.length > 0; }
      })
      .catch((e) => { if (!cancelled) { error = String(e); loading = false; } });
    return () => { cancelled = true; };
  });

  function selectCountry(code: string) {
    locationCode = code;
    showGrid = false;
    pushParams({ country: code, detail: "true" });
  }

  function backToGrid() {
    locationCode = "";
    showGrid = true;
    pushParams({ country: null, detail: null });
  }

  const PANELS = [
    {
      key: "conflictFatalities" as keyof TimelinePoint,
      label: "Conflict fatalities",
      color: "#e74c3c",
      fmt: (v: number) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v.toFixed(0),
      note: "annual total (ACLED)",
    },
    {
      key: "idpPopulation" as keyof TimelinePoint,
      label: "IDPs",
      color: "#f39c12",
      fmt: (v: number) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v.toFixed(0),
      note: "internally displaced persons",
    },
    {
      key: "foodPhase3Pct" as keyof TimelinePoint,
      label: "IPC Phase 3+ (%)",
      color: "#eb943b",
      fmt: (v: number) => v.toFixed(1) + "%",
      note: "% of assessed population in crisis or worse",
    },
    {
      key: "fundingGapPct" as keyof TimelinePoint,
      label: "Funding gap (%)",
      color: "#2980b9",
      fmt: (v: number) => v.toFixed(1) + "%",
      note: "% of humanitarian appeal unfunded",
    },
  ];

  $effect(() => {
    const _rows = rows;
    const _theme = theme;

    if (!el) return;
    if (!chart) {
      chart = echarts.init(el, null, { renderer: "canvas" });
      const ro = new ResizeObserver(() => chart?.resize());
      ro.observe(el);
    }

    if (_rows.length === 0) { chart.clear(); return; }

    const isDark = _theme === "dark";
    const textColor = isDark ? "#aaa" : "#444";
    const mutedColor = isDark ? "#555" : "#aaa";
    const gridColor = isDark ? "#1e2030" : "#f0f0f0";
    const tooltipBg = isDark ? "#1e1e2e" : "#fff";
    const tooltipBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

    const years = _rows.map((r) => r.year);

    const tops = ["1%", "26%", "52%", "77%"];
    const gridH = "19%";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const option: any = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: isDark ? "#ddd" : "#222", fontFamily: "system-ui, sans-serif", fontSize: 12 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any[]) => {
          if (!params?.length) return "";
          const year = params[0].axisValue;
          const lines = params
            .filter((p) => p.value != null)
            .map((p) => {
              const panel = PANELS[p.seriesIndex];
              return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>${panel.label}: <b>${panel.fmt(p.value)}</b>`;
            });
          return `<b>${year}</b><br/>${lines.join("<br/>")}`;
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
        type: "line",
      },
      grid: PANELS.map((_, i) => ({
        left: 72, right: 16, top: tops[i], height: gridH,
      })),
      xAxis: PANELS.map((_, i) => ({
        type: "category",
        data: years,
        gridIndex: i,
        boundaryGap: false,
        axisLabel: { show: i === 3, color: textColor, fontSize: 11 },
        axisTick: { show: i === 3, lineStyle: { color: isDark ? "#444" : "#ddd" } },
        axisLine: { lineStyle: { color: isDark ? "#333" : "#e0e0e0" } },
        splitLine: { show: false },
      })),
      yAxis: PANELS.map((p, i) => ({
        type: "value",
        gridIndex: i,
        name: p.label,
        nameLocation: "middle",
        nameGap: 58,
        nameRotate: 90,
        nameTextStyle: { color: p.color, fontSize: 10, fontFamily: "system-ui, sans-serif" },
        axisLabel: {
          color: mutedColor, fontSize: 9,
          formatter: (v: number) => p.fmt(v),
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: gridColor } },
        min: "dataMin",
      })),
      series: PANELS.map((p, i) => ({
        type: "line",
        xAxisIndex: i,
        yAxisIndex: i,
        data: _rows.map((r) => (r[p.key] as number | null)),
        lineStyle: { color: p.color, width: 2 },
        itemStyle: { color: p.color },
        symbol: "circle",
        symbolSize: 5,
        connectNulls: false,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: p.color + "33" },
            { offset: 1, color: p.color + "00" },
          ]),
        },
      })),
    };

    chart.setOption(option, { notMerge: true });
  });

  onDestroy(() => { window.removeEventListener("popstate", _popstate); chart?.dispose(); chart = undefined; });
</script>

<div class="wrapper">
  <nav class="topbar" class:dark={theme === "dark"}>
    {#if !showGrid}
      <button class="back-btn" onclick={backToGrid}>← All countries</button>
    {/if}

    <div class="ctrl-group">
      <label class="ctrl-label" for="country-sel">Country</label>
      <select id="country-sel" bind:value={locationCode}
        onchange={() => { if (locationCode) selectCountry(locationCode); else backToGrid(); }}
        disabled={countries.length === 0}>
        <option value="">Select crisis country…</option>
        {#each countries as c}
          <option value={c.code}>{c.name}</option>
        {/each}
      </select>
    </div>

    {#if rows.length > 0 && !showGrid}
      <span class="stat">
        {countries.find((c) => c.code === locationCode)?.name ?? locationCode} · {rows[0].year}–{rows[rows.length - 1].year}
      </span>
    {/if}

    {#if !showGrid}
      <div class="panel-notes">
        {#each PANELS as p}
          <span class="note-chip" style="border-color: {p.color}; color: {p.color}">{p.label}</span>
        {/each}
      </div>
    {/if}

    <button
      class="theme-toggle"
      class:dark={theme === "dark"}
      onclick={() => { theme = theme === "dark" ? "light" : "dark"; localStorage.setItem("theme", theme); }}
      aria-label="Toggle theme"
    >
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
      <span class="toggle-label">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  </nav>

  {#if showGrid}
    <CrisisTileGrid {theme} onSelect={selectCountry} />
  {:else}
    <div class="chart-area">
      {#if loading}
        <div class="overlay"><div class="spinner"></div><p>Loading crisis data…</p></div>
      {:else if error}
        <div class="overlay error"><p>Failed to load data</p><pre>{error}</pre></div>
      {:else if !hasData}
        <div class="overlay"><p>No crisis indicator data found for this country.</p></div>
      {/if}

      <div bind:this={el} class="chart" class:hidden={!hasData || loading || !!error}></div>

      {#if hasData && !loading && !error}
        <p class="hint">
          Hover to compare across panels · data from ACLED, IDMC, IPC, FTS
        </p>
      {/if}
    </div>
  {/if}
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

  .back-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 12px;
    padding: 3px 0;
    flex-shrink: 0;
    transition: color 0.15s;
    font-family: system-ui, sans-serif;
  }
  .back-btn:hover { color: var(--text); }

  .ctrl-group { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .ctrl-label { color: var(--text-muted); white-space: nowrap; }

  .ctrl-group select {
    font-size: 12px;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.15);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
    max-width: 200px;
  }
  .topbar.dark .ctrl-group select {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
    color: #ddd;
  }

  .stat { font-size: 12px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

  .panel-notes {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .note-chip {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 10px;
    border: 1px solid;
    white-space: nowrap;
    opacity: 0.75;
  }

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

  .chart-area { flex: 1; position: relative; min-height: 0; }

  .chart { width: 100%; height: 100%; }
  .chart.hidden { visibility: hidden; }

  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
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
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    color: var(--text-sep);
    pointer-events: none;
    white-space: nowrap;
  }
</style>
