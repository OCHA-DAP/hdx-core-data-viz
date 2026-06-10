<script lang="ts">
  import { onDestroy } from 'svelte'
  import embed from 'vega-embed'
  import type { BubbleRow } from '../lib/hapi.js'

  interface Props {
    data: BubbleRow[]
    level: 0 | 1 | 2
    theme: 'dark' | 'light'
    noDataCodes: Set<string>
    onselect: (code: string, name: string) => void
  }

  let { data, level, theme, noDataCodes, onselect }: Props = $props()

  let el: HTMLDivElement | undefined = $state()
  let currentView: any = undefined

  // risk_class is stored as "1"–"5" in HAPI (1=Very Low … 5=Very High)
  const RISK_DOMAIN = ['5', '4', '3', '2', '1']
  const RISK_RANGE  = ['#d73027', '#f46d43', '#fdae61', '#74add1', '#4575b4']

  interface ThemeColors {
    grid: string
    label: string
    title: string
    domain: string
    tick: string
    markStroke: string
    legendLabel: string
    legendTitle: string
  }

  function colors(t: 'dark' | 'light'): ThemeColors {
    return t === 'dark'
      ? {
          grid: 'rgba(255,255,255,0.08)',
          label: '#888',
          title: '#aaa',
          domain: 'rgba(255,255,255,0.2)',
          tick: 'rgba(255,255,255,0.2)',
          markStroke: 'rgba(255,255,255,0.15)',
          legendLabel: '#aaa',
          legendTitle: '#aaa',
        }
      : {
          grid: 'rgba(0,0,0,0.08)',
          label: '#555',
          title: '#333',
          domain: 'rgba(0,0,0,0.15)',
          tick: 'rgba(0,0,0,0.15)',
          markStroke: 'rgba(0,0,0,0.1)',
          legendLabel: '#555',
          legendTitle: '#333',
        }
  }

  function buildSpec(rows: BubbleRow[], t: 'dark' | 'light') {
    const c = colors(t)
    const minYear = Math.min(...rows.map(r => r.year).filter(Boolean))
    const maxYear = Math.max(...rows.map(r => r.year).filter(Boolean))
    const defaultYear = Math.min(maxYear, 2023)

    const axisConfig = {
      grid: true,
      gridColor: c.grid,
      labelColor: c.label,
      titleColor: c.title,
      domainColor: c.domain,
      tickColor: c.tick,
    }

    const colorEncoding =
      level === 0
        ? {
            field: 'risk_class',
            type: 'nominal' as const,
            scale: { domain: RISK_DOMAIN, range: RISK_RANGE },
            legend: {
              title: 'Risk class',
              labelColor: c.legendLabel,
              titleColor: c.legendTitle,
              symbolStrokeWidth: 0,
              labelExpr: `{'5':'Very High','4':'High','3':'Medium','2':'Low','1':'Very Low'}[datum.label] || datum.label`,
            },
          }
        : { value: '#f46d43' }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: 'container' as const,
      height: 'container' as const,
      background: 'transparent',
      autosize: { type: 'fit' as const, contains: 'padding' as const },
      padding: { top: 20, right: 20, bottom: 60, left: 60 },
      data: { values: rows },
      params: [
        {
          name: 'year',
          value: defaultYear,
          bind: {
            input: 'range',
            min: minYear || 2017,
            max: maxYear || 2024,
            step: 1,
            name: 'Year: ',
          },
        },
      ],
      transform: [{ filter: 'datum.year == year' }],
      mark: {
        type: 'circle' as const,
        stroke: c.markStroke,
        strokeWidth: 1,
      },
      encoding: {
        x: {
          field: 'fatalities_per_100k',
          type: 'quantitative' as const,
          scale: { type: 'symlog' as const, constant: 1 },
          axis: { title: 'Conflict fatalities per 100K population', ...axisConfig },
        },
        y: {
          field: 'ipc_phase3_fraction',
          type: 'quantitative' as const,
          scale: { domain: [0, 1] },
          axis: { title: 'Population in IPC Phase 3+ food crisis', format: '.0%', ...axisConfig },
        },
        size: {
          field: 'idp_population',
          type: 'quantitative' as const,
          scale: { range: [80, 4000], zero: true },
          legend: {
            title: 'IDP population',
            labelColor: c.legendLabel,
            titleColor: c.legendTitle,
          },
        },
        opacity: {
          condition: { test: 'datum.drillable !== false', value: 0.8 },
          value: 0.18,
        },
        color: colorEncoding,
        tooltip: [
          { field: 'name', title: 'Location' },
          { field: 'year', title: 'Year' },
          { field: 'fatalities_per_100k', title: 'Fatalities per 100K', format: '.1f' },
          { field: 'ipc_phase3_fraction', title: 'IPC Phase 3+', format: '.1%' },
          { field: 'idp_population', title: 'IDPs', format: ',d' },
          ...(level === 0 ? [{ field: 'risk_class', title: 'Risk class' }] : []),
          ...(level < 2 ? [{ field: 'drillHint', title: 'Sub-region data' }] : []),
        ],
      },
      config: {
        view: { stroke: 'transparent' },
        background: 'transparent',
        font: 'system-ui, sans-serif',
        range: { category: RISK_RANGE },
      },
    }
  }

  $effect(() => {
    if (!el) return
    const lv = level
    const t = theme
    // Annotate rows with drillability (reads noDataCodes, adding it as a dependency)
    const snapshot = data.map(r => ({
      ...r,
      drillable: lv >= 2 || !noDataCodes.has(r.code),
      drillHint: lv < 2
        ? (noDataCodes.has(r.code) ? 'No data at this level' : 'Available')
        : undefined,
    }))
    let alive = true

    const spec = buildSpec(snapshot, t)

    embed(el, spec, { actions: false, renderer: 'canvas' }).then(result => {
      if (!alive) {
        result.view.finalize()
        return
      }
      currentView?.finalize()
      currentView = result.view

      result.view.addEventListener('click', (_event: unknown, item: any) => {
        if (item?.datum?.code && lv < 2 && item.datum.drillable !== false) {
          onselect(item.datum.code, item.datum.name)
        }
      })
    })

    return () => {
      alive = false
    }
  })

  onDestroy(() => currentView?.finalize())
</script>

<div bind:this={el} class="chart"></div>

<style>
  .chart {
    width: 100%;
    height: 100%;
  }
</style>
