<script lang="ts">
  import type { EmbedOptions } from "vega-embed";

  interface Props {
    results: Record<string, unknown>[];
    isTrend: boolean;
    dimLabel: string;
    metricLabel: string;
  }

  let { results, isTrend, dimLabel, metricLabel }: Props = $props();

  let chartEl = $state<HTMLElement | undefined>();
  // Tracks the finalize fn from the previous embed so we can clean up.
  let prevFinalize: (() => void) | null = null;

  $effect(() => {
    const el = chartEl;
    if (!el || results.length === 0) return;

    const spec = isTrend ? buildTrendSpec() : buildBarSpec();
    const opts: EmbedOptions = { actions: false, renderer: "svg" };

    let cancelled = false;
    import("vega-embed").then(({ default: embed }) => {
      if (cancelled) return;
      if (prevFinalize) prevFinalize();
      embed(el, spec as never, opts).then((view) => {
        if (cancelled) { view.finalize(); return; }
        prevFinalize = view.finalize.bind(view);
      });
    });

    return () => {
      cancelled = true;
    };
  });

  function buildBarSpec() {
    const hasMultiMetric = results[0] && Object.keys(results[0]).length > 2;
    if (hasMultiMetric) return buildMultiMetricSpec();

    return {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      height: { step: 22 },
      data: { values: results },
      mark: { type: "bar", color: "#007ce0", cornerRadiusEnd: 2 },
      encoding: {
        y: {
          field: "dim",
          type: "nominal",
          sort: "-x",
          title: dimLabel,
          axis: { labelLimit: 220, labelFontSize: 11 },
        },
        x: {
          field: "value",
          type: "quantitative",
          title: metricLabel,
          axis: { format: "~s" },
        },
        tooltip: [
          { field: "dim", type: "nominal", title: dimLabel },
          { field: "value", type: "quantitative", format: ",.2f", title: metricLabel },
        ],
      },
    };
  }

  function buildTrendSpec() {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      height: 280,
      data: { values: results },
      mark: { type: "line", point: { color: "#007ce0", size: 40 }, color: "#007ce0" },
      encoding: {
        x: {
          field: "period",
          type: "temporal",
          timeUnit: "yearmonth",
          title: "Period",
        },
        y: {
          field: "value",
          type: "quantitative",
          title: metricLabel,
          axis: { format: "~s" },
        },
        tooltip: [
          { field: "period", type: "temporal", timeUnit: "yearmonth", title: "Period" },
          { field: "value", type: "quantitative", format: ",.2f", title: metricLabel },
        ],
      },
    };
  }

  function buildMultiMetricSpec() {
    // For lenses that return multiple metrics (e.g., needs-vs-funding: pop + funding_pct).
    const cols = Object.keys(results[0]).filter((k) => k !== "dim");
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      width: "container",
      height: { step: 22 },
      data: { values: results },
      mark: { type: "bar", color: "#007ce0", cornerRadiusEnd: 2 },
      encoding: {
        y: {
          field: "dim",
          type: "nominal",
          sort: { field: cols[0], order: "descending" },
          title: null,
          axis: { labelLimit: 220, labelFontSize: 11 },
        },
        x: {
          field: cols[0],
          type: "quantitative",
          title: cols[0].replace(/_/g, " "),
          axis: { format: "~s" },
        },
        tooltip: cols.map((c) => ({
          field: c,
          type: "quantitative",
          format: ",.2f",
          title: c.replace(/_/g, " "),
        })),
      },
    };
  }
</script>

<div class="chart-container" bind:this={chartEl}></div>

<style>
  .chart-container {
    width: 100%;
    min-height: 200px;
  }

  .chart-container :global(svg) {
    max-width: 100%;
  }
</style>
