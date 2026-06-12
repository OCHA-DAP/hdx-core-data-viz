<script lang="ts">
  import { onDestroy } from "svelte";
  import * as echarts from "echarts";
  import {
    fetchCountryList,
    fetchFoodPriceCategories,
    fetchFoodPrices,
    type CountryRow,
    type PricePoint,
  } from "../lib/hapi.js";

  let countries = $state<CountryRow[]>([]);
  let locationCode = $state("");
  let categories = $state<string[]>([]);
  let category = $state("");
  let prices = $state<PricePoint[]>([]);
  let normalized = $state(true);
  let loading = $state(false);
  let loadingCats = $state(false);
  let error = $state<string | null>(null);
  let theme = $state<"dark" | "light">("light");
  let el = $state<HTMLDivElement>();
  let chart: echarts.ECharts | undefined;

  $effect(() => { document.documentElement.dataset.theme = theme; });

  $effect(() => {
    fetchCountryList().then((list) => { countries = list; });
  });

  $effect(() => {
    const code = locationCode;
    if (!code) { categories = []; category = ""; return; }
    loadingCats = true;
    error = null;
    fetchFoodPriceCategories(code)
      .then((cats) => {
        categories = cats;
        category = cats[0] ?? "";
        loadingCats = false;
      })
      .catch((e) => { error = String(e); loadingCats = false; });
  });

  $effect(() => {
    const code = locationCode;
    const cat = category;
    if (!code || !cat) { prices = []; return; }
    let cancelled = false;
    loading = true;
    error = null;
    fetchFoodPrices(code, cat)
      .then((rows) => { if (!cancelled) { prices = rows; loading = false; } })
      .catch((e) => { if (!cancelled) { error = String(e); loading = false; } });
    return () => { cancelled = true; };
  });

  $effect(() => {
    const _prices = prices;
    const _theme = theme;
    const _norm = normalized;
    if (!el) return;

    if (!chart) {
      chart = echarts.init(el, null, { renderer: "canvas" });
      const ro = new ResizeObserver(() => chart?.resize());
      ro.observe(el);
    }

    const isDark = _theme === "dark";
    const textColor = isDark ? "#aaa" : "#444";
    const mutedColor = isDark ? "#555" : "#aaa";
    const tooltipBg = isDark ? "#1e1e2e" : "#fff";
    const tooltipBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

    if (_prices.length === 0) {
      chart.clear();
      return;
    }

    // Collect all unique months
    const monthSet = new Set<string>();
    const byCommodity = new Map<string, Map<string, number>>();
    const commodityUnit = new Map<string, string>();
    let currency = "";

    for (const p of _prices) {
      monthSet.add(p.month);
      if (!byCommodity.has(p.commodity)) byCommodity.set(p.commodity, new Map());
      byCommodity.get(p.commodity)!.set(p.month, p.price);
      commodityUnit.set(p.commodity, p.unit);
      if (!currency) currency = p.currency;
    }

    const months = [...monthSet].sort();

    const COLORS = [
      "#5470c6","#91cc75","#fac858","#ee6666","#73c0de",
      "#3ba272","#fc8452","#9a60b4","#ea7ccc","#48c9b0",
    ];

    const series: echarts.SeriesOption[] = [];
    let ci = 0;
    for (const [commodity, monthMap] of byCommodity) {
      const sortedMs = [...monthMap.keys()].sort();
      const base = _norm ? (monthMap.get(sortedMs[0]) ?? 1) : 1;
      const unit = commodityUnit.get(commodity) ?? "";
      series.push({
        name: commodity,
        type: "line",
        data: months.map((m) => {
          const v = monthMap.get(m);
          return v != null ? +(_norm ? (v / base) * 100 : v).toFixed(2) : null;
        }),
        symbol: "none",
        lineStyle: { color: COLORS[ci % COLORS.length], width: 2 },
        itemStyle: { color: COLORS[ci % COLORS.length] },
        connectNulls: false,
        tooltip: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          valueFormatter: (v: any) =>
            _norm
              ? `${Number(v).toFixed(1)} (index)`
              : `${Number(v).toFixed(2)} ${currency}/${unit}`,
        },
      });
      ci++;
    }

    const countryName = countries.find((c) => c.code === locationCode)?.name ?? locationCode;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const option: any = {
      backgroundColor: "transparent",
      title: {
        text: `Food prices · ${countryName}`,
        subtext: `${category}${_norm ? " · price index (earliest = 100)" : ` · avg market price in ${currency}`}`,
        left: "center",
        top: 8,
        textStyle: { color: textColor, fontSize: 13, fontWeight: "500", fontFamily: "system-ui, sans-serif" },
        subtextStyle: { color: mutedColor, fontSize: 11, fontFamily: "system-ui, sans-serif" },
      },
      legend: {
        type: "scroll",
        bottom: 12,
        textStyle: { color: textColor, fontSize: 11, fontFamily: "system-ui, sans-serif" },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: isDark ? "#ddd" : "#222", fontFamily: "system-ui, sans-serif" },
      },
      grid: { left: 64, right: 16, top: 64, bottom: 72 },
      xAxis: {
        type: "category",
        data: months,
        axisLabel: {
          color: textColor,
          interval: Math.max(0, Math.floor(months.length / 12) - 1),
          rotate: months.length > 36 ? 30 : 0,
          fontSize: 11,
        },
        axisLine: { lineStyle: { color: isDark ? "#444" : "#ddd" } },
        axisTick: { lineStyle: { color: isDark ? "#444" : "#ddd" } },
      },
      yAxis: {
        type: "value",
        name: _norm ? "Price index" : `Price (${currency})`,
        nameTextStyle: { color: mutedColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 11 },
        splitLine: { lineStyle: { color: isDark ? "#1e2030" : "#f0f0f0" } },
      },
      series,
    };

    chart.setOption(option, { notMerge: true });
  });

  onDestroy(() => { chart?.dispose(); chart = undefined; });
</script>

<div class="wrapper">
  <nav class="topbar" class:dark={theme === "dark"}>
    <div class="ctrl-group">
      <label class="ctrl-label" for="country-sel">Country</label>
      <select id="country-sel" bind:value={locationCode} disabled={countries.length === 0}>
        <option value="">Select country…</option>
        {#each countries as c}
          <option value={c.code}>{c.name}</option>
        {/each}
      </select>
    </div>

    {#if categories.length > 0}
      <div class="ctrl-group">
        <label class="ctrl-label" for="cat-sel">Category</label>
        <select id="cat-sel" bind:value={category}>
          {#each categories as cat}
            <option value={cat}>{cat}</option>
          {/each}
        </select>
      </div>
    {/if}

    <div class="ctrl-group">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={normalized} />
        Normalize (index)
      </label>
    </div>

    {#if prices.length > 0}
      <span class="stat">{new Set(prices.map((p) => p.commodity)).size} commodities · {new Set(prices.map((p) => p.month)).size} months</span>
    {/if}

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
    {#if !locationCode}
      <div class="overlay"><p>Select a country to explore food price trends.</p></div>
    {:else if loadingCats}
      <div class="overlay"><div class="spinner"></div><p>Loading categories…</p></div>
    {:else if categories.length === 0 && !loadingCats}
      <div class="overlay"><p>No food price data available for this country.</p></div>
    {:else if loading}
      <div class="overlay"><div class="spinner"></div><p>Loading prices…</p></div>
    {:else if error}
      <div class="overlay error"><p>Failed to load data</p><pre>{error}</pre></div>
    {:else if prices.length === 0 && category}
      <div class="overlay"><p>No price data for "{category}" in this country.</p></div>
    {/if}

    <div bind:this={el} class="chart" class:hidden={!prices.length || loading || !!error || !locationCode}></div>

    {#if prices.length > 0 && !loading && !error}
      <p class="hint">WFP market price data · averaged across markets per month</p>
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

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
  }

  .stat { font-size: 12px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

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
