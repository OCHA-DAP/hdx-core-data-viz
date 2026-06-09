<script lang="ts">
  interface Props {
    results: Record<string, unknown>[];
  }

  let { results }: Props = $props();

  const columns = $derived(results.length > 0 ? Object.keys(results[0]) : []);

  function format(val: unknown): string {
    if (val === null || val === undefined) return "—";
    if (typeof val === "number") {
      if (Number.isInteger(val)) return val.toLocaleString();
      // Fractions likely 0–1 or small floats
      if (Math.abs(val) < 10) return val.toFixed(2);
      return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
    }
    return String(val);
  }

  function colLabel(key: string): string {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
</script>

<div class="table-wrap">
  <div class="row-count">{results.length} row{results.length !== 1 ? "s" : ""}</div>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          {#each columns as col}
            <th>{colLabel(col)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each results as row}
          <tr>
            {#each columns as col}
              <td class:num={typeof row[col] === "number"}>{format(row[col])}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .table-wrap {
    overflow: hidden;
  }

  .row-count {
    font-size: 12px;
    color: #888;
    margin-bottom: 0.4rem;
  }

  .table-scroll {
    overflow-x: auto;
    max-height: 480px;
    overflow-y: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  th {
    position: sticky;
    top: 0;
    background: #eeeeee;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.4rem 0.75rem;
    text-align: left;
    border: 1px solid #cccccc;
    white-space: nowrap;
  }

  td {
    padding: 0.35rem 0.75rem;
    border: 1px solid #e0e0e0;
    color: #333;
    white-space: nowrap;
  }

  td.num {
    text-align: right;
    font-feature-settings: "tnum";
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }

  tr:hover td {
    background: #f4f9ff;
  }
</style>
