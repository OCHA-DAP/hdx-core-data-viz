<script lang="ts">
  import { onDestroy } from "svelte";
  import * as echarts from "echarts";
  import {
    fetchFoodPricesAllCategories,
    type FoodPriceCategoryData,
  } from "../lib/hapi.js";

  let {
    locationCode,
    countryName,
    theme,
    normalized,
    panelHeight = 220,
  }: {
    locationCode: string;
    countryName: string;
    theme: "dark" | "light";
    normalized: boolean;
    panelHeight?: number;
  } = $props();

  let allCats = $state<FoodPriceCategoryData[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let el = $state<HTMLDivElement>();
  let chart: echarts.ECharts | undefined;
  let chartHeightPx = $derived(allCats.length > 0 ? Math.max(600, allCats.length * panelHeight) : 0);

  $effect(() => {
    const code = locationCode;
    loading = true;
    error = null;
    allCats = [];
    fetchFoodPricesAllCategories(code)
      .then((r) => { allCats = r; loading = false; })
      .catch((e) => { error = String(e); loading = false; });
  });

  const COLORS = [
    "#5470c6","#91cc75","#fac858","#ee6666","#73c0de",
    "#3ba272","#fc8452","#9a60b4","#ea7ccc","#48c9b0",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildOption(cats: FoodPriceCategoryData[], isDark: boolean, norm: boolean): any {
    const textColor = isDark ? "#aaa" : "#444";
    const mutedColor = isDark ? "#555" : "#aaa";
    const gridColor = isDark ? "#1e2030" : "#f0f0f0";
    const tooltipBg = isDark ? "#1e1e2e" : "#fff";
    const tooltipBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

    // Compute global month union so all panels share the same x domain
    const monthSet = new Set<string>();
    for (const cat of cats) for (const p of cat.commodities) monthSet.add(p.month);
    const globalMonths = [...monthSet].sort();

    // Layout geometry
    const N = cats.length;
    const padTop = 2, padBottom = 5, gap = 2;
    const panelH = (100 - padTop - padBottom - gap * (N - 1)) / N;
    const topPct = (i: number) => padTop + i * (panelH + gap);
    const titleSize = N <= 5 ? 10 : 9;

    // Build series and catForSeries mapping
    const series: object[] = [];
    const catForSeries: number[] = [];

    for (let i = 0; i < cats.length; i++) {
      const cat = cats[i];
      const byCommodity = new Map<string, Map<string, number>>();
      const commodityUnit = new Map<string, string>();
      let currency = "";

      for (const p of cat.commodities) {
        if (!byCommodity.has(p.commodity)) byCommodity.set(p.commodity, new Map());
        byCommodity.get(p.commodity)!.set(p.month, p.price);
        commodityUnit.set(p.commodity, p.unit);
        if (!currency) currency = p.currency;
      }

      let ci = 0;
      for (const [commodity, monthMap] of byCommodity) {
        const color = COLORS[ci % COLORS.length];
        const unit = commodityUnit.get(commodity) ?? "";
        const sortedMs = [...monthMap.keys()].sort();
        const base = norm ? (monthMap.get(sortedMs[0]) ?? 1) : 1;
        catForSeries.push(i);
        series.push({
          name: commodity,
          type: "line",
          xAxisIndex: i,
          yAxisIndex: i,
          data: globalMonths.map((m) => {
            const v = monthMap.get(m);
            return v != null ? +(norm ? (v / base) * 100 : v).toFixed(2) : null;
          }),
          symbol: "none",
          lineStyle: { color, width: 1.5 },
          itemStyle: { color },
          connectNulls: false,
          // suppress auto legend / tooltip unit; we handle in formatter
          tooltip: { valueFormatter: undefined },
          _unit: unit,
          _currency: currency,
        });
        ci++;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tooltipFormatter = (params: any[]) => {
      if (!params?.length) return "";
      const month = params[0].axisValue as string;
      const yr = month.slice(0, 4);
      const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(month.slice(5, 7)) - 1] ?? "";
      const byCat = new Map<number, typeof params>();
      for (const p of params) {
        const ci = catForSeries[p.seriesIndex];
        if (ci === undefined) continue;
        if (!byCat.has(ci)) byCat.set(ci, []);
        byCat.get(ci)!.push(p);
      }
      const parts: string[] = [`<b style="font-size:12px">${mo} ${yr}</b>`];
      for (const [ci, ps] of [...byCat.entries()].sort((a, b) => a[0] - b[0])) {
        parts.push(
          `<div style="margin-top:5px;font-size:10px;color:${mutedColor};font-weight:600;letter-spacing:0.02em">${cats[ci].category}</div>`
        );
        for (const p of ps) {
          if (p.value == null) continue;
          const val = norm ? Number(p.value).toFixed(1) : Number(p.value).toFixed(2);
          parts.push(
            `<div style="display:flex;align-items:center;gap:4px;font-size:11px;padding:1px 0">` +
            `<span style="width:7px;height:7px;border-radius:50%;background:${p.color};display:inline-block;flex-shrink:0"></span>` +
            `<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.seriesName}</span>` +
            `<b style="margin-left:6px;white-space:nowrap">${val}</b>` +
            `</div>`
          );
        }
      }
      return `<div style="max-width:260px">${parts.join("")}</div>`;
    };

    const titleRoom = 2.8; // % of canvas height per panel reserved for the category title
    return {
      backgroundColor: "transparent",
      title: cats.map((cat, i) => ({
        text: cat.category,
        left: 76,
        top: `${topPct(i)}%`,
        textStyle: {
          color: textColor,
          fontSize: titleSize,
          fontWeight: "600",
          fontFamily: "system-ui, sans-serif",
        },
      })),
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: isDark ? "#ddd" : "#222", fontFamily: "system-ui, sans-serif", fontSize: 11 },
        formatter: tooltipFormatter,
      },
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
        type: "line",
        lineStyle: { color: isDark ? "#666" : "#bbb", type: "dashed" },
      },
      grid: cats.map((_, i) => ({
        left: 72,
        right: 16,
        top: `${topPct(i) + titleRoom}%`,
        height: `${panelH - titleRoom}%`,
      })),
      xAxis: cats.map((_, i) => ({
        type: "category",
        data: globalMonths,
        gridIndex: i,
        boundaryGap: false,
        axisLabel: {
          show: i === N - 1,
          color: textColor,
          fontSize: 10,
          interval: 11,
          hideOverlap: true,
          formatter: (v: string) => v.slice(0, 4),
        },
        axisTick: { show: i === N - 1, lineStyle: { color: isDark ? "#444" : "#ddd" } },
        axisLine: { lineStyle: { color: isDark ? "#333" : "#e0e0e0" } },
        splitLine: { show: false },
      })),
      yAxis: cats.map((cat, i) => ({
        type: "value",
        gridIndex: i,
        name: norm ? "Index" : (cat.commodities[0]?.currency ?? ""),
        nameLocation: "middle",
        nameGap: 44,
        nameRotate: 90,
        nameTextStyle: { color: mutedColor, fontSize: 9, fontFamily: "system-ui, sans-serif" },
        axisLabel: {
          color: mutedColor,
          fontSize: 9,
          formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "K" : v.toFixed(0),
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: gridColor } },
        min: norm ? 0 : "dataMin",
      })),
      series,
    };
  }

  $effect(() => {
    const _cats = allCats;
    const _theme = theme;
    const _norm = normalized;
    void panelHeight; // re-run when zoom changes so resize fires after DOM update

    if (!el) return;
    if (!chart) {
      chart = echarts.init(el, null, { renderer: "canvas" });
      const ro = new ResizeObserver(() => chart?.resize());
      ro.observe(el);
    }

    if (_cats.length === 0) { chart.clear(); return; }
    // Defer resize to let the DOM apply the new height before ECharts measures it
    requestAnimationFrame(() => chart?.resize());
    chart.setOption(buildOption(_cats, _theme === "dark", _norm), { notMerge: true });
  });

  onDestroy(() => { chart?.dispose(); chart = undefined; });
</script>

<div class="cats-wrap" class:dark={theme === "dark"}>
  {#if loading}
    <div class="overlay"><div class="spinner"></div><p>Loading price data…</p></div>
  {:else if error}
    <div class="overlay error"><p>Failed to load data</p><pre>{error}</pre></div>
  {:else if allCats.length === 0}
    <div class="overlay"><p>No food price data available for {countryName}.</p></div>
  {/if}

  <div bind:this={el} class="chart" style:height="{chartHeightPx}px" class:hidden={loading || !!error || allCats.length === 0}></div>

  {#if !loading && !error && allCats.length > 0}
    <p class="hint">WFP market price data · hover to compare across panels · top 8 commodities per category</p>
  {/if}
</div>

<style>
  .cats-wrap {
    flex: 1;
    position: relative;
    min-height: 0;
    overflow-y: auto;
    color: var(--text);
  }

  .chart {
    width: 100%;
  }
  .chart.hidden {
    visibility: hidden;
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
    display: block;
    text-align: center;
    padding: 6px 0 14px;
    font-size: 11px;
    color: var(--text-sep);
    pointer-events: none;
  }
</style>
