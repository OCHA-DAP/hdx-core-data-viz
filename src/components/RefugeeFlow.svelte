<script lang="ts">
  import { onDestroy } from "svelte";
  import * as echarts from "echarts";
  import { fetchRefugeeFlows, type FlowRow } from "../lib/hapi.js";

  let year = $state(2024);
  let topN = $state(15);
  let showASY = $state(true);
  let loading = $state(true);
  let hasData = $state(false); // stays true once first data arrives
  let error = $state<string | null>(null);
  let flows = $state<FlowRow[]>([]);
  let theme = $state<"dark" | "light">("light");
  let el = $state<HTMLDivElement>();
  let playing = $state(false);
  let focusedNode = $state<string | null>(null);

  let chart: echarts.ECharts | undefined;
  let playTimer: ReturnType<typeof setInterval> | undefined;

  const totalPeople = $derived(flows.reduce((sum, f) => sum + f.total, 0));

  // Stable country→color map so colors don't shift between years
  const PALETTE = [
    "#5470c6","#91cc75","#fac858","#ee6666","#73c0de",
    "#3ba272","#fc8452","#9a60b4","#ea7ccc","#48c9b0",
    "#f39c12","#e74c3c","#2ecc71","#e67e22","#1abc9c",
    "#8e44ad","#d35400","#27ae60","#c0392b","#2980b9",
  ];
  const countryColors = new Map<string, string>();
  function colorFor(name: string): string {
    if (!countryColors.has(name)) {
      countryColors.set(name, PALETTE[countryColors.size % PALETTE.length]);
    }
    return countryColors.get(name)!;
  }

  $effect(() => {
    document.documentElement.dataset.theme = theme;
  });

  $effect(() => {
    const _year = year;
    const _topN = topN;
    const _groups = showASY ? ["REF", "ASY"] : ["REF"];
    let cancelled = false;

    loading = true;
    error = null;

    fetchRefugeeFlows(_year, _topN, _groups)
      .then((rows) => {
        if (!cancelled) {
          flows = rows;
          loading = false;
          hasData = true;
        }
      })
      .catch((e) => {
        if (!cancelled) {
          error = String(e);
          loading = false;
        }
      });

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const _flows = flows;
    const _theme = theme;
    const _year = year;
    const _topN = topN;

    if (!el) return;

    if (!chart) {
      chart = echarts.init(el, null, { renderer: "canvas" });
      const ro = new ResizeObserver(() => chart?.resize());
      ro.observe(el);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chart.on("click", (params: any) => {
        if (params.componentType === "series" && params.dataType === "node") {
          const name: string = params.name;
          if (focusedNode === name) {
            focusedNode = null;
            chart?.dispatchAction({ type: "downplay", seriesIndex: 0 });
          } else {
            focusedNode = name;
            chart?.dispatchAction({ type: "highlight", seriesIndex: 0, name });
          }
        } else if (params.componentType === "series" && params.dataType === "edge") {
          // clicking a ribbon clears focus
          focusedNode = null;
          chart?.dispatchAction({ type: "downplay", seriesIndex: 0 });
        }
      });
    }

    const isDark = _theme === "dark";
    const textColor = isDark ? "#aaa" : "#444";
    const mutedColor = isDark ? "#555" : "#aaa";
    const tooltipBg = isDark ? "#1e1e2e" : "#fff";
    const tooltipBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

    const nodeNames = [...new Set(_flows.flatMap((f) => [f.origin, f.asylum]))];
    const nodes = nodeNames.map((name) => ({ name, itemStyle: { color: colorFor(name) } }));
    const links = _flows.map((f) => ({ source: f.origin, target: f.asylum, value: f.total }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const option: any = {
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 600,
      animationEasing: "cubicInOut",
      title: {
        text: `Refugee flows · ${_year}`,
        subtext: `Top ${_topN} countries by total involvement`,
        left: "center",
        top: 8,
        textStyle: {
          color: textColor,
          fontSize: 13,
          fontWeight: "500",
          fontFamily: "system-ui, sans-serif",
        },
        subtextStyle: {
          color: mutedColor,
          fontSize: 11,
          fontFamily: "system-ui, sans-serif",
        },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: isDark ? "#ddd" : "#222" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          if (params.dataType === "edge") {
            return `${params.data.source} → ${params.data.target}<br/><b>${Number(params.data.value).toLocaleString()}</b> people`;
          }
          return `<b>${params.name}</b>`;
        },
      },
      series: [
        {
          type: "chord",
          data: nodes,
          links: links,
          emphasis: { focus: "adjacency" },
          label: {
            show: true,
            color: textColor,
            fontSize: 11,
          },
          lineStyle: {
            color: "source",
            opacity: 0.55,
            curveness: 0.5,
          },
          itemStyle: {
            borderWidth: 1,
          },
        },
      ],
    };

    chart.setOption(option, { notMerge: true });
  });

  function advanceYear(dir: 1 | -1) {
    year = Math.max(2001, Math.min(2024, year + dir));
  }

  function togglePlay() {
    if (playing) {
      clearInterval(playTimer);
      playTimer = undefined;
      playing = false;
    } else {
      playing = true;
      playTimer = setInterval(() => {
        if (year >= 2024) {
          year = 2001;
        } else {
          year++;
        }
      }, 1500);
    }
  }

  onDestroy(() => {
    clearInterval(playTimer);
    chart?.dispose();
    chart = undefined;
  });
</script>

<div class="wrapper">
  <nav class="topbar" class:dark={theme === "dark"}>
    <div class="year-ctrl">
      <button class="step-btn" onclick={() => advanceYear(-1)} disabled={year <= 2001}>◀</button>
      <input
        type="range"
        min="2001"
        max="2024"
        step="1"
        bind:value={year}
        class="year-slider"
      />
      <button class="step-btn" onclick={() => advanceYear(1)} disabled={year >= 2024}>▶</button>
      <span class="year-label">{year}</span>
      <button class="play-btn" class:active={playing} onclick={togglePlay}>
        {playing ? "■" : "▶"} {playing ? "Stop" : "Play"}
      </button>
    </div>

    <div class="ctrl-group">
      <label class="ctrl-label" for="topn-select">Countries</label>
      <select
        id="topn-select"
        onchange={(e) => (topN = parseInt((e.target as HTMLSelectElement).value, 10))}
      >
        <option value="10" selected={topN === 10}>Top 10</option>
        <option value="15" selected={topN === 15}>Top 15</option>
        <option value="20" selected={topN === 20}>Top 20</option>
      </select>
    </div>

    <div class="ctrl-group">
      <label class="checkbox-label">
        <input type="checkbox" checked={showASY} onchange={() => (showASY = !showASY)} />
        Include asylum seekers
      </label>
    </div>

    {#if hasData && totalPeople > 0}
      <span class="total-stat">{totalPeople.toLocaleString()} people in view</span>
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
    {#if !hasData && loading}
      <div class="overlay">
        <div class="spinner"></div>
        <p>Loading {year} refugee flows…</p>
      </div>
    {:else if error}
      <div class="overlay error">
        <p>Failed to load data</p>
        <pre>{error}</pre>
      </div>
    {:else if !loading && flows.length === 0}
      <div class="overlay">
        <p>No refugee flow data for {year}.</p>
      </div>
    {/if}

    {#if hasData && loading}
      <div class="updating-badge">Updating…</div>
    {/if}

    <div bind:this={el} class="chart" class:hidden={!hasData || !!error}></div>

    {#if hasData && !error}
      <p class="hint">
        Ribbon color = origin country · hover a country arc to highlight its flows
        {#if focusedNode}<span class="focused-hint"> · click again to clear</span>{/if}
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

  .topbar.dark {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

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
    min-width: 34px;
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
  .step-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .step-btn:not(:disabled):hover {
    color: var(--text);
    background: var(--hover-bg);
  }

  .play-btn {
    background: none;
    border: 1px solid var(--text-sep);
    color: var(--text-muted);
    cursor: pointer;
    padding: 3px 10px;
    font-size: 11px;
    border-radius: 4px;
    transition:
      color 0.15s,
      background 0.15s;
    white-space: nowrap;
  }
  .play-btn:hover,
  .play-btn.active {
    color: var(--text);
    background: var(--hover-bg);
  }

  .ctrl-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .ctrl-label {
    color: var(--text-muted);
    white-space: nowrap;
  }

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

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
  }

  .total-stat {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
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
  .theme-toggle:hover {
    color: var(--text);
  }

  .toggle-track {
    position: relative;
    width: 36px;
    height: 20px;
    background: #ccc;
    border-radius: 10px;
    transition: background 0.25s;
    flex-shrink: 0;
  }
  .dark .toggle-track {
    background: #f46d43;
  }

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
  .dark .toggle-thumb {
    transform: translateX(16px);
  }

  .toggle-label {
    min-width: 28px;
  }

  .chart-area {
    flex: 1;
    position: relative;
    min-height: 0;
  }

  .chart {
    width: 100%;
    height: 100%;
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
    overflow: auto;
    white-space: pre-wrap;
  }

  .updating-badge {
    position: absolute;
    top: 12px;
    right: 16px;
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg);
    border: 1px solid var(--text-sep);
    border-radius: 4px;
    padding: 2px 8px;
    z-index: 2;
    pointer-events: none;
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

  .focused-hint {
    color: #f46d43;
  }
</style>
