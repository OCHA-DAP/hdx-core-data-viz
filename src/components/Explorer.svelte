<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    buildBubbleData,
    fetchNonDrillableCodes,
    fetchCountryList,
    AXIS_VARS,
    SIZE_VARS,
    type AdminLevel,
    type BubbleRow,
    type DataAvailability,
  } from "../lib/hapi.js";
  import BubbleChart from "./BubbleChart.svelte";
  import { readParams, updateParams, pushParams } from "../lib/urlState.js";

  const _p = readParams();
  const _xDefault = "ipc_phase3_fraction";
  const _yDefault = "funding_gap_pct";
  const _szDefault = "idp_population";
  const _xIds = new Set(AXIS_VARS.map((v) => v.id));
  const _szIds = new Set(SIZE_VARS.map((v) => v.id));

  const _lvl = parseInt(_p.get("level") ?? "", 10);
  let level: AdminLevel = $state(([0, 1, 2].includes(_lvl) ? _lvl : 0) as AdminLevel);
  let countryCode: string | undefined = $state(_p.get("country") ?? undefined);
  let countryName: string | undefined = $state();
  let admin1Code: string | undefined = $state(_p.get("admin1") ?? undefined);
  let admin1Name: string | undefined = $state();
  let theme: "dark" | "light" = $state(localStorage.getItem("theme") === "dark" ? "dark" : "light");

  let xVarId: string = $state(_xIds.has(_p.get("x") ?? "") ? _p.get("x")! : _xDefault);
  let yVarId: string = $state(_xIds.has(_p.get("y") ?? "") ? _p.get("y")! : _yDefault);
  let sizeVarId: string = $state(_szIds.has(_p.get("size") ?? "") ? _p.get("size")! : _szDefault);

  const _urlYear = parseInt(_p.get("year") ?? "", 10);
  let _yearFromUrl = Number.isFinite(_urlYear) && _urlYear > 1990 ? _urlYear : 0;

  const xSpec = $derived(AXIS_VARS.find((v) => v.id === xVarId)!);
  const ySpec = $derived(AXIS_VARS.find((v) => v.id === yVarId)!);
  const sizeSpec = $derived(SIZE_VARS.find((v) => v.id === sizeVarId)!);

  let data: BubbleRow[] = $state([]);
  let selectedYear: number = $state(_yearFromUrl);
  let loading = $state(true);
  let error: string | null = $state(null);
  let noDataCodes: Set<string> = $state(new Set());
  let dataAvailability: DataAvailability | null = $state(null);
  let playing = $state(false);
  let playTimer: ReturnType<typeof setInterval> | undefined;

  const years = $derived.by(() => {
    const s = new Set(
      data
        .filter((r) => r.x != null && r.y != null)
        .map((r) => r.year)
        .filter(Boolean),
    );
    return [...s].sort((a, b) => a - b);
  });

  const crumbs = $derived.by(() => {
    const items: { label: string; target: AdminLevel }[] = [{ label: "World", target: 0 }];
    if (countryName && level >= 1) items.push({ label: countryName, target: 1 });
    if (admin1Name && level >= 2) items.push({ label: admin1Name, target: 2 });
    return items;
  });

  const AVAIL_LABELS: [keyof DataAvailability, string][] = [
    ["population", "Baseline population"],
    ["conflict", "Conflict events"],
    ["food", "Food security (IPC)"],
    ["humNeeds", "Humanitarian needs"],
    ["idps", "IDPs"],
    ["poverty", "Poverty rate"],
    ["rainfall", "Rainfall anomaly"],
    ["refugees", "Refugees & asylum seekers"],
  ];

  function availItems(a: DataAvailability) {
    return AVAIL_LABELS.filter(([k]) => a[k] !== "not-needed").map(([k, label]) => ({
      label,
      status: a[k],
      text:
        a[k] === "available"
          ? "✓ available"
          : a[k] === "aggregated"
            ? "↑ admin-2 aggregated to admin-1"
            : "✗ not available",
    }));
  }

  $effect(() => {
    document.documentElement.dataset.theme = theme;
  });

  $effect(() => {
    updateParams({
      level: level === 0 ? null : String(level),
      country: countryCode ?? null,
      admin1: admin1Code ?? null,
      x: xVarId === _xDefault ? null : xVarId,
      y: yVarId === _yDefault ? null : yVarId,
      size: sizeVarId === _szDefault ? null : sizeVarId,
      year: selectedYear > 0 ? String(selectedYear) : null,
    });
  });

  function drillTo(target: AdminLevel) {
    if (target >= level) return;
    if (target < 2) { admin1Code = undefined; admin1Name = undefined; }
    if (target < 1) {
      countryCode = undefined;
      countryName = undefined;
      if (AXIS_VARS.find((v) => v.id === xVarId)?.subNationalOnly) xVarId = "hum_needs_per_100k";
      if (AXIS_VARS.find((v) => v.id === yVarId)?.subNationalOnly) yVarId = "hum_needs_per_100k";
    }
    level = target;
    pushParams({
      level: target === 0 ? null : String(target),
      country: target >= 1 ? countryCode ?? null : null,
      admin1: target >= 2 ? admin1Code ?? null : null,
    });
  }

  function onSelect(code: string, name: string) {
    if (level === 0) {
      if (AXIS_VARS.find((v) => v.id === xVarId)?.levelOnly === 0) xVarId = "hum_needs_per_100k";
      if (AXIS_VARS.find((v) => v.id === yVarId)?.levelOnly === 0) yVarId = "hum_needs_per_100k";
      countryCode = code;
      countryName = name;
      level = 1;
      pushParams({ level: "1", country: code, admin1: null });
    } else if (level === 1) {
      admin1Code = code;
      admin1Name = name;
      level = 2;
      pushParams({ level: "2", admin1: code });
    }
  }

  $effect(() => {
    const _level = level;
    const _parent = _level === 1 ? countryCode : _level === 2 ? admin1Code : undefined;
    const _x = xVarId;
    const _y = yVarId;
    const _sz = sizeVarId;
    let cancelled = false;

    loading = true;
    error = null;

    buildBubbleData(_level, _parent, _x, _y, _sz)
      .then(({ rows, availability: avail }) => {
        if (!cancelled) {
          dataAvailability = avail;
          data = rows;
          if (rows.length === 0 && _parent) noDataCodes.add(_parent);
          if (_level === 0) {
            const codes = [...new Set(rows.map((r) => r.code))];
            fetchNonDrillableCodes(codes).then((nd) => {
              if (!cancelled) noDataCodes = nd;
            });
          }
          const rowYears = [
            ...new Set(
              rows
                .filter((r) => r.x != null && r.y != null)
                .map((r) => r.year)
                .filter(Boolean),
            ),
          ].sort((a, b) => a - b);
          const yearCounts = new Map<number, number>();
          for (const r of rows.filter((r) => r.x != null && r.y != null)) {
            yearCounts.set(r.year, (yearCounts.get(r.year) ?? 0) + 1);
          }
          const bestYear =
            [...yearCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
          selectedYear = rowYears.includes(selectedYear)
            ? selectedYear
            : rowYears.includes(2023)
              ? 2023
              : bestYear;
          if (countryCode && !countryName) {
            fetchCountryList().then((list) => {
              const c = list.find((r) => r.code === countryCode);
              if (c) countryName = c.name;
            });
          }
          loading = false;
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

  function stepYear(dir: 1 | -1) {
    const idx = years.indexOf(selectedYear);
    const next = idx + dir;
    if (next >= 0 && next < years.length) selectedYear = years[next];
  }

  function togglePlay() {
    if (playing) {
      clearInterval(playTimer);
      playTimer = undefined;
      playing = false;
    } else {
      playing = true;
      playTimer = setInterval(() => {
        const idx = years.indexOf(selectedYear);
        selectedYear = idx >= years.length - 1 ? (years[0] ?? selectedYear) : (years[idx + 1] ?? selectedYear);
      }, 1500);
    }
  }

  function applyUrlParams() {
    const p = readParams();
    const lvl = parseInt(p.get("level") ?? "", 10);
    level = ([0, 1, 2].includes(lvl) ? lvl : 0) as AdminLevel;
    countryCode = p.get("country") ?? undefined;
    countryName = undefined;
    admin1Code = p.get("admin1") ?? undefined;
    admin1Name = undefined;
    xVarId = _xIds.has(p.get("x") ?? "") ? p.get("x")! : _xDefault;
    yVarId = _xIds.has(p.get("y") ?? "") ? p.get("y")! : _yDefault;
    sizeVarId = _szIds.has(p.get("size") ?? "") ? p.get("size")! : _szDefault;
    const urlYear = parseInt(p.get("year") ?? "", 10);
    selectedYear = Number.isFinite(urlYear) && urlYear > 1990 ? urlYear : 0;
  }

  let _popstate: () => void;
  onMount(() => { _popstate = applyUrlParams; window.addEventListener("popstate", _popstate); });
  onDestroy(() => { window.removeEventListener("popstate", _popstate); clearInterval(playTimer); });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && level > 0) drillTo((level - 1) as AdminLevel);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="explorer">
  <nav class="topbar" class:dark={theme === "dark"}>
    <div class="crumbs">
      {#each crumbs as crumb, i (i)}
        {#if i > 0}<span class="sep">›</span>{/if}
        {#if i < crumbs.length - 1}
          <button class="crumb" onclick={() => drillTo(crumb.target)}>{crumb.label}</button>
        {:else}
          <span class="crumb current">{crumb.label}</span>
        {/if}
      {/each}
    </div>

    {#if !error && years.length > 0}
      <div class="year-ctrl">
        {#if years.length > 1}
          <button class="step-btn" onclick={() => stepYear(-1)} disabled={years.indexOf(selectedYear) <= 0}>◀</button>
          <input
            type="range"
            class="year-slider"
            min={0}
            max={years.length - 1}
            step="1"
            value={years.indexOf(selectedYear)}
            oninput={(e) => {
              const idx = parseInt((e.target as HTMLInputElement).value, 10);
              selectedYear = years[idx] ?? selectedYear;
            }}
          />
          <button class="step-btn" onclick={() => stepYear(1)} disabled={years.indexOf(selectedYear) >= years.length - 1}>▶</button>
        {/if}
        <span class="year-label">{selectedYear}</span>
        <button class="play-btn" class:active={playing} onclick={togglePlay}>
          {playing ? "■" : "▶"} {playing ? "Stop" : "Play"}
        </button>
      </div>
    {/if}

    <div class="ctrl-group">
      <label class="ctrl-label" for="x-axis-sel">X axis</label>
      <select
        id="x-axis-sel"
        title={`${xSpec.yearNote ?? ""}${xSpec.levelNote ? ` · ${xSpec.levelNote}` : ""}${xSpec.levelOnly === 0 ? " · national level only" : xSpec.subNationalOnly ? " · sub-national only" : ""}`}
        value={xVarId}
        onchange={(e) => {
          xVarId = (e.target as HTMLSelectElement).value;
        }}
      >
        {#each AXIS_VARS as v (v.id)}
          <option
            value={v.id}
            disabled={v.id === yVarId ||
              (v.levelOnly === 0 && level > 0) ||
              (v.subNationalOnly === true && level === 0)}
            >{v.label}{v.levelOnly === 0 && level > 0
              ? " (national only)"
              : v.subNationalOnly && level === 0
                ? " (sub-national only)"
                : ""}</option
          >
        {/each}
      </select>
    </div>

    <div class="ctrl-group">
      <label class="ctrl-label" for="y-axis-sel">Y axis</label>
      <select
        id="y-axis-sel"
        title={`${ySpec.yearNote ?? ""}${ySpec.levelNote ? ` · ${ySpec.levelNote}` : ""}${ySpec.levelOnly === 0 ? " · national level only" : ySpec.subNationalOnly ? " · sub-national only" : ""}`}
        value={yVarId}
        onchange={(e) => {
          yVarId = (e.target as HTMLSelectElement).value;
        }}
      >
        {#each AXIS_VARS as v (v.id)}
          <option
            value={v.id}
            disabled={v.id === xVarId ||
              (v.levelOnly === 0 && level > 0) ||
              (v.subNationalOnly === true && level === 0)}
            >{v.label}{v.levelOnly === 0 && level > 0
              ? " (national only)"
              : v.subNationalOnly && level === 0
                ? " (sub-national only)"
                : ""}</option
          >
        {/each}
      </select>
    </div>

    <div class="ctrl-group">
      <label class="ctrl-label" for="size-sel">Bubble size</label>
      <select
        id="size-sel"
        title={sizeSpec.yearNote ?? ""}
        value={sizeVarId}
        onchange={(e) => {
          sizeVarId = (e.target as HTMLSelectElement).value;
        }}
      >
        {#each SIZE_VARS as v (v.id)}
          <option value={v.id} disabled={v.levelOnly === 0 && level > 0}
            >{v.label}{v.levelOnly === 0 && level > 0 ? " (national only)" : ""}</option
          >
        {/each}
      </select>
    </div>

    <button
      class="theme-toggle"
      class:dark={theme === "dark"}
      onclick={() => { theme = theme === "dark" ? "light" : "dark"; localStorage.setItem("theme", theme); }}
      aria-label="Toggle theme"
    >
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
      <span class="toggle-label">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  </nav>

  <div class="chart-area">
    {#if loading}
      <div class="overlay">
        <div class="spinner"></div>
        <p>Loading data…</p>
      </div>
    {:else if error}
      <div class="overlay error">
        <p>Failed to load data</p>
        <pre>{error}</pre>
      </div>
    {:else if data.length === 0 || (level > 0 && years.length === 0)}
      <div class="overlay">
        {#if level > 0 && dataAvailability}
          <p class="no-data-title">
            No sub-national data for {level === 1 ? countryName : admin1Name}
          </p>
          <div class="avail-list">
            {#each availItems(dataAvailability) as item (item.label)}
              <div class="avail-row">
                <span class="avail-label">{item.label}</span>
                <span class="avail-badge avail-{item.status}">{item.text}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p>No data available for this region.</p>
        {/if}
      </div>
    {:else}
      <BubbleChart
        {data}
        year={selectedYear}
        {level}
        {theme}
        {noDataCodes}
        onselect={onSelect}
        {xSpec}
        {ySpec}
        {sizeSpec}
      />
      {#if level < 2}
        <p class="hint">
          {#if noDataCodes.size > 0}
            Click a highlighted bubble to drill down · Faded = no sub-region data
          {:else}
            Click a bubble to drill down
          {/if}
        </p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .explorer {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    color: var(--text);
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    margin-right: 4px;
  }

  .sep {
    color: var(--text-sep);
    margin: 0 2px;
    font-size: 11px;
  }

  .crumb {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
    font-family: system-ui, sans-serif;
  }

  .crumb:hover {
    color: var(--text);
    background: var(--hover-bg);
  }

  .crumb.current {
    color: var(--text);
    cursor: default;
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
  }
  .topbar.dark .ctrl-group select {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
    color: #ddd;
  }
  .ctrl-group select option:disabled {
    color: #aaa;
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
    transition: color 0.15s, background 0.15s;
    white-space: nowrap;
    font-family: system-ui, sans-serif;
  }
  .play-btn:hover,
  .play-btn.active {
    color: var(--text);
    background: var(--hover-bg);
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
  }

  .no-data-title {
    font-size: 14px;
    color: var(--text);
    margin-bottom: 12px;
  }

  .avail-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 280px;
  }

  .avail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-size: 12px;
  }

  .avail-label {
    color: var(--text-muted);
  }

  .avail-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    white-space: nowrap;
  }

  .avail-available {
    color: #4caf50;
    background: rgba(76, 175, 80, 0.1);
  }

  .avail-aggregated {
    color: #f46d43;
    background: rgba(244, 109, 67, 0.1);
  }

  .avail-unavailable {
    color: var(--text-sep);
    background: rgba(0, 0, 0, 0.05);
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

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .hint {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    color: var(--text-sep);
    pointer-events: none;
    white-space: nowrap;
  }

  .toast {
    position: absolute;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 30, 30, 0.92);
    color: #fff;
    padding: 10px 18px;
    border-radius: 6px;
    font-size: 13px;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
    backdrop-filter: blur(4px);
    animation: fadein 0.2s ease;
  }

  @keyframes fadein {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
