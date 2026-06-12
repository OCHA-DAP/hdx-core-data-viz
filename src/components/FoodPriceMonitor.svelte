<script lang="ts">
  import FoodPriceTileGrid from "./FoodPriceTileGrid.svelte";
  import FoodPriceCategoryCharts from "./FoodPriceCategoryCharts.svelte";
  import { fetchFoodPriceGlobal } from "../lib/hapi.js";

  let countries = $state<{ code: string; name: string }[]>([]);
  let locationCode = $state("");
  let normalized = $state(true);
  let theme = $state<"dark" | "light">("light");
  let showGrid = $state(true);
  let panelHeight = $state(220);

  $effect(() => { document.documentElement.dataset.theme = theme; });

  $effect(() => {
    fetchFoodPriceGlobal().then((rows) => {
      countries = rows.map((r) => ({ code: r.code, name: r.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    });
  });

  function selectCountry(code: string) {
    locationCode = code;
    showGrid = false;
  }

  function backToGrid() {
    locationCode = "";
    showGrid = true;
  }
</script>

<div class="wrapper">
  <nav class="topbar" class:dark={theme === "dark"}>
    {#if !showGrid}
      <button class="back-btn" onclick={backToGrid}>← All countries</button>
    {/if}

    <div class="ctrl-group">
      <label class="ctrl-label" for="country-sel">Country</label>
      <select id="country-sel" bind:value={locationCode}
        onchange={() => { if (locationCode) { showGrid = false; } else backToGrid(); }}
        disabled={countries.length === 0}>
        <option value="">Select country…</option>
        {#each countries as c}
          <option value={c.code}>{c.name}</option>
        {/each}
      </select>
    </div>

    {#if !showGrid}
      <div class="ctrl-group">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={normalized} />
          Normalize (index)
        </label>
      </div>

      <div class="ctrl-group">
        <span class="ctrl-label">Zoom</span>
        <div class="zoom-ctrl">
          <button class="step-btn" onclick={() => panelHeight = Math.max(150, panelHeight - 40)} disabled={panelHeight <= 150}>◀</button>
          <input
            type="range"
            class="zoom-slider"
            min="150"
            max="520"
            step="10"
            bind:value={panelHeight}
          />
          <button class="step-btn" onclick={() => panelHeight = Math.min(520, panelHeight + 40)} disabled={panelHeight >= 520}>▶</button>
        </div>
      </div>
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

  {#if showGrid}
    <FoodPriceTileGrid {theme} onSelect={selectCountry} />
  {:else}
    <FoodPriceCategoryCharts
      {locationCode}
      countryName={countries.find((c) => c.code === locationCode)?.name ?? locationCode}
      {theme}
      {normalized}
      {panelHeight}
    />
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

  .zoom-ctrl {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .zoom-slider {
    width: 120px;
    height: 6px;
    accent-color: #f46d43;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
  }

  .zoom-slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: var(--spinner-track, rgba(0, 0, 0, 0.12));
  }

  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #f46d43;
    margin-top: -6px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  }

  .zoom-slider::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--spinner-track, rgba(0, 0, 0, 0.12));
  }

  .zoom-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #f46d43;
    border: none;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
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
</style>
