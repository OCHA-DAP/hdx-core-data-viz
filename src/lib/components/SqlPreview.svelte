<script lang="ts">
  interface Props {
    sql: string;
  }

  let { sql }: Props = $props();
  let copied = $state(false);

  async function copy() {
    await navigator.clipboard.writeText(sql);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<div class="sql-preview">
  <div class="sql-header">
    <span class="sql-label">Generated SQL</span>
    <button class="copy-btn" onclick={copy}>{copied ? "Copied!" : "Copy"}</button>
  </div>
  <pre class="sql-body"><code>{sql}</code></pre>
  <p class="sql-note">
    DuckDB-WASM executes this query in your browser via HTTP range reads against remote Parquet files.
    No data is sent to any server.
  </p>
</div>

<style>
  .sql-preview {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }

  .sql-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: #f8f8f8;
    border-bottom: 1px solid #e0e0e0;
  }

  .sql-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
  }

  .copy-btn {
    font-size: 12px;
    padding: 0.15rem 0.6rem;
    border: 1px solid #ccc;
    border-radius: 3px;
    background: #fff;
    cursor: pointer;
    color: #555;
  }

  .copy-btn:hover {
    background: #f0f0f0;
  }

  .sql-body {
    margin: 0;
    padding: 0.75rem 1rem;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    line-height: 1.6;
    color: #1f2937;
    background: #fafafa;
    overflow-x: auto;
    white-space: pre;
  }

  .sql-note {
    margin: 0;
    padding: 0.5rem 0.75rem;
    font-size: 11px;
    color: #999;
    border-top: 1px solid #e0e0e0;
    background: #f8f8f8;
  }
</style>
