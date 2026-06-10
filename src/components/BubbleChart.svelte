<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import * as echarts from 'echarts'
  import type { BubbleRow } from '../lib/hapi.js'

  interface Props {
    data: BubbleRow[]
    year: number
    level: 0 | 1 | 2
    theme: 'dark' | 'light'
    noDataCodes: Set<string>
    onselect: (code: string, name: string) => void
  }

  let { data, year, level, theme, noDataCodes, onselect }: Props = $props()

  let el: HTMLDivElement | undefined = $state()
  let chart: echarts.ECharts | undefined

  const RISK_COLORS: Record<string, string> = {
    '5': '#d73027', '4': '#f46d43', '3': '#fdae61', '2': '#74add1', '1': '#4575b4',
  }
  const RISK_LABELS: Record<string, string> = {
    '5': 'Very High', '4': 'High', '3': 'Medium', '2': 'Low', '1': 'Very Low',
  }
  const RISK_ORDER = ['5', '4', '3', '2', '1']
  const SIZE_EXAMPLES = [
    { pop: 0,          label: '0' },
    { pop: 10_000_000, label: '10 M' },
    { pop: 20_000_000, label: '20 M' },
    { pop: 30_000_000, label: '30 M' },
  ]
  const LEGEND_MAX_D = 36

  // Symlog approximation for x >= 0: maps 0 → 0, spreads large values logarithmically
  function symlog(x: number | null | undefined): number {
    return Math.log1p(x ?? 0)
  }
  function symexp(y: number): number {
    return Math.expm1(y)
  }

  // Map idp_population to symbol diameter (px), matching Vega area scale [80, 4000]
  const MAX_IDP = 30_000_000
  function sizeOf(pop: number | null | undefined): number {
    const area = pop ? 80 + (4000 - 80) * Math.min(pop / MAX_IDP, 1) : 80
    return 2 * Math.sqrt(area / Math.PI)
  }

  function makeSeriesData(rows: BubbleRow[], lv: number, ndc: Set<string>) {
    return rows.map(r => {
      const drillable = lv >= 2 || !ndc.has(r.code)
      return {
        id: r.code,
        name: r.name,
        value: [symlog(r.fatalities_per_100k), r.ipc_phase3_fraction ?? 0],
        symbolSize: sizeOf(r.idp_population),
        itemStyle: {
          color: lv === 0 ? (RISK_COLORS[r.risk_class ?? ''] ?? '#f46d43') : '#f46d43',
          opacity: drillable ? 0.8 : 0.18,
          borderColor: 'rgba(0,0,0,0.12)',
          borderWidth: 1,
        },
        // stashed for click handler and tooltip
        code: r.code,
        drillable,
        raw: r,
      }
    })
  }

  function buildOption(rows: BubbleRow[], t: 'dark' | 'light', lv: number, ndc: Set<string>) {
    const isDark = t === 'dark'
    const textColor   = isDark ? '#888' : '#555'
    const titleColor  = isDark ? '#aaa' : '#333'
    const gridColor   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
    const tooltipBg   = isDark ? '#1e1e2e' : '#fff'
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'

    return {
      animation: false,
      animationDurationUpdate: 700,
      animationEasingUpdate: 'cubicInOut' as const,
      backgroundColor: 'transparent',
      grid: { top: 20, right: 172, bottom: 64, left: 76 },
      xAxis: {
        type: 'value' as const,
        name: 'Conflict fatalities per 100K population',
        nameLocation: 'middle' as const,
        nameGap: 44,
        nameTextStyle: { color: titleColor, fontSize: 12 },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: (v: number) => {
            const orig = symexp(v)
            if (orig < 0.1) return '0'
            if (orig < 10)  return orig.toFixed(1)
            return Math.round(orig).toLocaleString()
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'value' as const,
        name: 'Population in IPC Phase 3+ food crisis',
        nameLocation: 'middle' as const,
        nameGap: 52,
        nameTextStyle: { color: titleColor, fontSize: 12 },
        min: 0,
        max: 1,
        axisLabel: {
          color: textColor,
          fontSize: 11,
          formatter: (v: number) => Math.round(v * 100) + '%',
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: gridColor } },
      },
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: isDark ? '#ddd' : '#333', fontSize: 12 },
        formatter: (params: any) => {
          const r = params.data.raw as BubbleRow
          const lines = [
            `<b>${r.name}</b>`,
            `Year: ${r.year ?? '—'}`,
            `Fatalities per 100K: ${r.fatalities_per_100k != null ? r.fatalities_per_100k.toFixed(1) : '—'}`,
            `IPC Phase 3+: ${r.ipc_phase3_fraction != null ? (r.ipc_phase3_fraction * 100).toFixed(1) + '%' : '—'}`,
            `IDPs: ${r.idp_population != null ? r.idp_population.toLocaleString() : '—'}`,
          ]
          if (lv === 0 && r.risk_class) lines.push(`Risk class: ${RISK_LABELS[r.risk_class] ?? r.risk_class}`)
          if (lv < 2) lines.push(`Sub-region data: ${params.data.drillable ? 'Available' : 'No data at this level'}`)
          return lines.join('<br/>')
        },
      },
      series: [{
        id: 'bubbles',
        type: 'scatter' as const,
        data: makeSeriesData(rows, lv, ndc),
        cursor: lv < 2 ? 'pointer' : 'default',
        emphasis: { scale: 1.15 },
      }],
    }
  }

  // Effect 1: full rebuild on structural changes (data, level, theme, noDataCodes).
  // Year is read via untrack so this never re-runs when only the year changes.
  $effect(() => {
    if (!el) return
    const t = theme
    const lv = level
    const ndc = new Set(noDataCodes)
    const yr = untrack(() => year)
    const rows = data.filter(r => r.year === yr)

    if (!chart) {
      chart = echarts.init(el, null, { renderer: 'canvas' })
      const ro = new ResizeObserver(() => chart?.resize())
      ro.observe(el)

      chart.on('click', (params: any) => {
        const lv2 = untrack(() => level)
        if (params.data?.code && lv2 < 2 && params.data?.drillable) {
          onselect(params.data.code, params.data.name)
        }
      })
    }

    chart.setOption(buildOption(rows, t, lv, ndc), { notMerge: true })
  })

  // Effect 2: animate year changes — only tracks `year`.
  // Everything else is read via untrack so structural changes don't trigger this.
  $effect(() => {
    const yr = year
    if (!chart) return
    const lv  = untrack(() => level)
    const ndc = new Set(untrack(() => noDataCodes))
    const rows = untrack(() => data).filter(r => r.year === yr)

    chart.setOption({
      animation: true,
      series: [{ id: 'bubbles', data: makeSeriesData(rows, lv, ndc) }],
    })
  })

  onDestroy(() => {
    chart?.dispose()
    chart = undefined
  })
</script>

<div class="wrap">
  <div bind:this={el} class="chart"></div>

  <div class="legend" class:dark={theme === 'dark'}>
    {#if level === 0}
      <div class="legend-group">
        <p class="legend-title">Risk class</p>
        {#each RISK_ORDER as k}
          <div class="legend-row">
            <span class="dot" style:background={RISK_COLORS[k]}></span>
            <span class="legend-label">{RISK_LABELS[k]}</span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="legend-group">
      <p class="legend-title">IDP population</p>
      {#each SIZE_EXAMPLES as { pop, label }}
        {@const d = sizeOf(pop) * LEGEND_MAX_D / sizeOf(MAX_IDP)}
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
          <span class="legend-label">{label}</span>
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
