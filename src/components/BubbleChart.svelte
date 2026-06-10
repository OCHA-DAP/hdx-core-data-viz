<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import * as echarts from "echarts";
  import type { CallbackDataParams, ECElementEvent } from "echarts/types/dist/shared.js";
  import type { BubbleRow, VariableSpec } from "../lib/hapi.js";

  interface Props {
    data: BubbleRow[];
    year: number;
    level: 0 | 1 | 2;
    theme: "dark" | "light";
    noDataCodes: Set<string>;
    onselect: (code: string, name: string) => void;
    xSpec: VariableSpec;
    ySpec: VariableSpec;
    sizeSpec: VariableSpec;
  }

  let { data, year, level, theme, noDataCodes, onselect, xSpec, ySpec, sizeSpec }: Props = $props();

  let el: HTMLDivElement | undefined = $state();
  let chart: echarts.ECharts | undefined;

  const RISK_COLORS: Record<string, string> = {
    "5": "#d73027",
    "4": "#f46d43",
    "3": "#fdae61",
    "2": "#74add1",
    "1": "#4575b4",
  };
  const RISK_LABELS: Record<string, string> = {
    "5": "Very High",
    "4": "High",
    "3": "Medium",
    "2": "Low",
    "1": "Very Low",
  };
  const RISK_ORDER = ["5", "4", "3", "2", "1"];
  const LEGEND_MAX_D = 36;

  function symlog(x: number | null | undefined): number {
    return Math.log1p(x ?? 0);
  }
  function symexp(y: number): number {
    return Math.expm1(y);
  }

  function applyScale(v: number | null | undefined, spec: VariableSpec): number {
    return spec.scale === "symlog" ? symlog(v) : (v ?? 0);
  }

  function sizeOf(v: number | null | undefined, maxVal: number): number {
    const capped = Math.min(v ?? 0, maxVal);
    const area = maxVal > 0 ? 80 + (4000 - 80) * (capped / maxVal) : 80;
    return 2 * Math.sqrt(area / Math.PI);
  }

  const sizeMax = $derived(sizeSpec.sizeMax ?? Math.max(1, ...data.map((r) => r.size)));

  const sizeExamples = $derived(
    sizeSpec.sizeExamples ??
      [0, 0.33, 0.67, 1].map((f) => ({
        value: Math.round(f * sizeMax),
        label: sizeSpec.format(Math.round(f * sizeMax)),
      })),
  );

  function makeSeriesData(rows: BubbleRow[], lv: number, ndc: Set<string>, maxSz: number) {
    return rows
      .filter((r) => r.x != null && r.y != null)
      .map((r) => {
        const drillable = lv >= 2 || !ndc.has(r.code);
        return {
          id: r.code,
          name: r.name,
          value: [applyScale(r.x, xSpec), applyScale(r.y, ySpec)],
          symbolSize: sizeOf(r.size, maxSz),
          itemStyle: {
            color: lv === 0 ? (RISK_COLORS[r.risk_class ?? ""] ?? "#f46d43") : "#f46d43",
            opacity: drillable ? 0.8 : 0.18,
            borderColor: "rgba(0,0,0,0.12)",
            borderWidth: 1,
          },
          code: r.code,
          drillable,
          raw: r,
        };
      });
  }

  function axisFormatter(spec: VariableSpec) {
    return (v: number) => {
      if (spec.scale === "symlog") {
        const orig = symexp(v);
        if (orig < 0.1) return "0";
        if (orig < 10) return orig.toFixed(1);
        return Math.round(orig).toLocaleString();
      }
      if (spec.max != null && spec.max <= 1) return Math.round(v * 100) + "%";
      return v.toLocaleString();
    };
  }

  function buildOption(
    rows: BubbleRow[],
    t: "dark" | "light",
    lv: number,
    ndc: Set<string>,
    maxSz: number,
    yr: number,
  ) {
    const isDark = t === "dark";
    const textColor = isDark ? "#888" : "#555";
    const titleColor = isDark ? "#aaa" : "#333";
    const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const tooltipBg = isDark ? "#1e1e2e" : "#fff";
    const tooltipBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

    return {
      animation: false,
      animationDurationUpdate: 700,
      animationEasingUpdate: "cubicInOut" as const,
      backgroundColor: "transparent",
      grid: { top: 20, right: 172, bottom: 64, left: 76 },
      xAxis: {
        type: "value" as const,
        name: xSpec.label,
        nameLocation: "middle" as const,
        nameGap: 44,
        nameTextStyle: { color: titleColor, fontSize: 12 },
        min: xSpec.scale === "symlog" ? undefined : xSpec.min,
        max: xSpec.scale === "symlog" ? undefined : xSpec.max,
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: axisFormatter(xSpec),
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: "value" as const,
        name: ySpec.label,
        nameLocation: "middle" as const,
        nameGap: 52,
        nameTextStyle: { color: titleColor, fontSize: 12 },
        min: ySpec.scale === "symlog" ? undefined : ySpec.min,
        max: ySpec.scale === "symlog" ? undefined : ySpec.max,
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: axisFormatter(ySpec),
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: gridColor } },
      },
      tooltip: {
        trigger: "item" as const,
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: isDark ? "#ddd" : "#333", fontSize: 12 },
        formatter: (params: CallbackDataParams) => {
          const r = params.data.raw as BubbleRow;
          const lines = [
            `<b>${r.name}</b>`,
            `Year: ${r.year ?? "—"}`,
            `${xSpec.label}: ${r.x != null ? xSpec.format(r.x) : "—"}`,
            `${ySpec.label}: ${r.y != null ? ySpec.format(r.y) : "—"}`,
            `${sizeSpec.label}: ${sizeSpec.format(r.size)}`,
          ];
          if (lv === 0 && r.risk_class)
            lines.push(`Risk class: ${RISK_LABELS[r.risk_class] ?? r.risk_class}`);
          if (lv < 2)
            lines.push(
              `Sub-region data: ${params.data.drillable ? "Available" : "No data at this level"}`,
            );
          return lines.join("<br/>");
        },
      },
      graphic: [
        {
          type: "text",
          right: 180,
          bottom: 70,
          z: 0,
          style: {
            text: yr ? String(yr) : "",
            fontSize: 120,
            fontWeight: "bold",
            fill: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            textAlign: "right",
          },
        },
      ],
      series: [
        {
          id: "bubbles",
          type: "scatter" as const,
          data: makeSeriesData(rows, lv, ndc, maxSz),
          cursor: lv < 2 ? "pointer" : "default",
          emphasis: { scale: 1.15 },
        },
      ],
    };
  }

  $effect(() => {
    if (!el) return;
    const t = theme;
    const lv = level;
    const ndc = new Set(noDataCodes);
    const maxSz = untrack(() => sizeMax);
    const yr = untrack(() => year);
    const rows = data.filter((r) => r.year === yr);
    const _xSpec = xSpec;
    const _ySpec = ySpec;

    void _xSpec;
    void _ySpec; // ensure reactive dependency

    if (!chart) {
      chart = echarts.init(el, null, { renderer: "canvas" });
      const ro = new ResizeObserver(() => chart?.resize());
      ro.observe(el);

      chart.on("click", (params: ECElementEvent) => {
        const lv2 = untrack(() => level);
        if (params.data?.code && lv2 < 2 && params.data?.drillable) {
          onselect(params.data.code, params.data.name);
        }
      });
    }

    chart.setOption(buildOption(rows, t, lv, ndc, maxSz, yr), { notMerge: true });
  });

  $effect(() => {
    const yr = year;
    if (!chart) return;
    const lv = untrack(() => level);
    const ndc = new Set(untrack(() => noDataCodes));
    const maxSz = untrack(() => sizeMax);
    const rows = untrack(() => data).filter((r) => r.year === yr);

    chart.setOption({
      animation: true,
      graphic: [{ style: { text: String(yr) } }],
      series: [{ id: "bubbles", data: makeSeriesData(rows, lv, ndc, maxSz) }],
    });
  });

  onDestroy(() => {
    chart?.dispose();
    chart = undefined;
  });
</script>

<div class="wrap">
  <div bind:this={el} class="chart"></div>

  <div class="legend" class:dark={theme === "dark"}>
    {#if level === 0}
      <div class="legend-group">
        <p class="legend-title">Risk class</p>
        {#each RISK_ORDER as k (k)}
          <div class="legend-row">
            <span class="dot" style:background={RISK_COLORS[k]}></span>
            <span class="legend-label">{RISK_LABELS[k]}</span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="legend-group">
      <p class="legend-title">{sizeSpec.label}</p>
      {#each sizeExamples as ex (ex.value)}
        {@const d = (sizeOf(ex.value, sizeMax) * LEGEND_MAX_D) / sizeOf(sizeMax, sizeMax)}
        <div class="size-row">
          <svg width={LEGEND_MAX_D} height={LEGEND_MAX_D}>
            <circle
              cx={LEGEND_MAX_D / 2}
              cy={LEGEND_MAX_D / 2}
              r={Math.max(d / 2, 1)}
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              opacity="0.45"
            />
          </svg>
          <span class="legend-label">{ex.label}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .wrap {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .chart {
    width: 100%;
    height: 100%;
  }

  .legend {
    position: absolute;
    top: 20px;
    right: 8px;
    width: 152px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    color: #555;
    font-size: 11px;
    pointer-events: none;
    user-select: none;
  }

  .legend.dark {
    color: #888;
  }

  .legend-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .legend-title {
    margin: 0 0 4px;
    font-size: 11px;
    color: inherit;
    opacity: 0.7;
  }

  .legend-row {
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 1.4;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.85;
  }

  .legend-label {
    color: inherit;
  }

  .size-row {
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 1;
  }

  .size-row svg {
    flex-shrink: 0;
  }
</style>
