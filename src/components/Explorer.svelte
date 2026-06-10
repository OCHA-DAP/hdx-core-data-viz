<script lang="ts">
  import { buildBubbleData, AXIS_VARS, SIZE_VARS, type AdminLevel, type BubbleRow } from '../lib/hapi.js'
  import BubbleChart from './BubbleChart.svelte'

  let level: AdminLevel = $state(0)
  let countryCode: string | undefined = $state()
  let countryName: string | undefined = $state()
  let admin1Code: string | undefined = $state()
  let admin1Name: string | undefined = $state()
  let theme: 'dark' | 'light' = $state('light')

  let xVarId: string = $state('conflict_fatalities_per_100k')
  let yVarId: string = $state('ipc_phase3_fraction')
  let sizeVarId: string = $state('idp_population')

  const xSpec = $derived(AXIS_VARS.find(v => v.id === xVarId)!)
  const ySpec = $derived(AXIS_VARS.find(v => v.id === yVarId)!)
  const sizeSpec = $derived(SIZE_VARS.find(v => v.id === sizeVarId)!)

  let data: BubbleRow[] = $state([])
  let selectedYear: number = $state(0)
  let loading = $state(true)
  let error: string | null = $state(null)
  let noDataCodes: Set<string> = $state(new Set())
  let toastMessage: string | null = $state(null)
  let toastTimer: ReturnType<typeof setTimeout> | null = null
  let wasDrillAttempt = false

  const years = $derived.by(() => {
    const s = new Set(
      data.filter(r => r.x != null && r.y != null).map(r => r.year).filter(Boolean)
    )
    return [...s].sort((a, b) => a - b)
  })

  const crumbs = $derived.by(() => {
    const items: { label: string; target: AdminLevel }[] = [{ label: 'World', target: 0 }]
    if (countryName && level >= 1) items.push({ label: countryName, target: 1 })
    if (admin1Name && level >= 2) items.push({ label: admin1Name, target: 2 })
    return items
  })

  $effect(() => {
    document.documentElement.dataset.theme = theme
  })

  function drillTo(target: AdminLevel) {
    if (target >= level) return
    if (target < 2) { admin1Code = undefined; admin1Name = undefined }
    if (target < 1) { countryCode = undefined; countryName = undefined }
    level = target
  }

  function onSelect(code: string, name: string) {
    wasDrillAttempt = true
    if (level === 0) {
      // Reset level-0-only variables before drilling in
      if (AXIS_VARS.find(v => v.id === xVarId)?.levelOnly === 0)
        xVarId = 'conflict_fatalities_per_100k'
      if (AXIS_VARS.find(v => v.id === yVarId)?.levelOnly === 0)
        yVarId = 'ipc_phase3_fraction'
      countryCode = code
      countryName = name
      level = 1
    } else if (level === 1) {
      admin1Code = code
      admin1Name = name
      level = 2
    }
  }

  function showToast(msg: string) {
    toastMessage = msg
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastMessage = null }, 4000)
  }

  $effect(() => {
    const _level = level
    const _parent = _level === 1 ? countryCode : _level === 2 ? admin1Code : undefined
    const _x = xVarId
    const _y = yVarId
    const _sz = sizeVarId
    const _isDrill = wasDrillAttempt
    wasDrillAttempt = false
    let cancelled = false

    loading = true
    error = null

    buildBubbleData(_level, _parent, _x, _y, _sz)
      .then(rows => {
        if (!cancelled) {
          if (rows.length === 0 && _isDrill) {
            const failedName = _level === 1 ? countryName : admin1Name
            if (_parent) noDataCodes.add(_parent)
            showToast(`No sub-region data available for ${failedName ?? _parent}`)
            drillTo((_level - 1) as AdminLevel)
          } else {
            data = rows
            const rowYears = [
              ...new Set(rows.filter(r => r.x != null && r.y != null).map(r => r.year).filter(Boolean))
            ].sort((a, b) => a - b)
            const maxY = rowYears[rowYears.length - 1] ?? 0
            selectedYear = rowYears.includes(selectedYear)
              ? selectedYear
              : rowYears.includes(2023) ? 2023 : maxY
            loading = false
          }
        }
      })
      .catch(e => {
        if (!cancelled) {
          error = String(e)
          loading = false
        }
      })

    return () => { cancelled = true }
  })

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && level > 0) drillTo((level - 1) as AdminLevel)
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="explorer">
  <nav class="breadcrumb">
    <div class="crumbs">
      {#each crumbs as crumb, i}
        {#if i > 0}<span class="sep">›</span>{/if}
        {#if i < crumbs.length - 1}
          <button class="crumb" onclick={() => drillTo(crumb.target)}>{crumb.label}</button>
        {:else}
          <span class="crumb current">{crumb.label}</span>
        {/if}
      {/each}
    </div>

    <button
      class="theme-toggle"
      class:dark={theme === 'dark'}
      onclick={() => theme = theme === 'dark' ? 'light' : 'dark'}
      aria-label="Toggle theme"
    >
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
      <span class="toggle-label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  </nav>

  <div class="controls" class:dark={theme === 'dark'}>
    <label class="ctrl-label">
      X axis
      <select
        value={xVarId}
        onchange={(e) => { xVarId = (e.target as HTMLSelectElement).value }}
      >
        {#each AXIS_VARS as v}
          <option
            value={v.id}
            disabled={v.id === yVarId || (v.levelOnly === 0 && level > 0)}
          >{v.label}</option>
        {/each}
      </select>
    </label>

    <label class="ctrl-label">
      Y axis
      <select
        value={yVarId}
        onchange={(e) => { yVarId = (e.target as HTMLSelectElement).value }}
      >
        {#each AXIS_VARS as v}
          <option
            value={v.id}
            disabled={v.id === xVarId || (v.levelOnly === 0 && level > 0)}
          >{v.label}</option>
        {/each}
      </select>
    </label>

    <label class="ctrl-label">
      Bubble size
      <select
        value={sizeVarId}
        onchange={(e) => { sizeVarId = (e.target as HTMLSelectElement).value }}
      >
        {#each SIZE_VARS as v}
          <option value={v.id}>{v.label}</option>
        {/each}
      </select>
    </label>

    {#if !loading && !error && years.length > 0}
      <div class="year-ctrl">
        {#if years.length > 1}
          <span class="year-bound">{years[0]}</span>
          <input
            type="range"
            min={0}
            max={years.length - 1}
            step="1"
            value={years.indexOf(selectedYear)}
            oninput={(e) => {
              const idx = parseInt((e.target as HTMLInputElement).value, 10)
              selectedYear = years[idx] ?? selectedYear
            }}
          />
          <span class="year-bound">{years[years.length - 1]}</span>
        {/if}
      </div>
    {/if}
  </div>

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
    {:else if data.length === 0}
      <div class="overlay">
        <p>No data available for this region.</p>
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
    {#if toastMessage}
      <div class="toast" role="alert">{toastMessage}</div>
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

  .breadcrumb {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px 0;
    font-size: 14px;
    flex-shrink: 0;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .sep {
    color: var(--text-sep);
    margin: 0 2px;
  }

  .crumb {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }

  .crumb:hover {
    color: var(--text);
    background: var(--hover-bg);
  }

  .crumb.current {
    color: var(--text);
    cursor: default;
  }

  .controls {
    display: flex;
    gap: 16px;
    padding: 10px 20px 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--domain, rgba(0,0,0,0.06));
  }

  .ctrl-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .ctrl-label select {
    font-size: 12px;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid var(--domain, rgba(0,0,0,0.15));
    background: var(--bg, #fff);
    color: var(--text);
    cursor: pointer;
    max-width: 260px;
  }

  .controls.dark .ctrl-label select {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.15);
    color: #ddd;
  }

  .ctrl-label select option:disabled {
    color: #aaa;
  }

  .year-ctrl {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .year-bound {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .year-ctrl input[type='range'] {
    width: 140px;
    height: 6px;
    accent-color: #f46d43;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
  }

  .year-ctrl input[type='range']::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: var(--spinner-track, rgba(0,0,0,0.12));
  }

  .year-ctrl input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #f46d43;
    margin-top: -7px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    transition: transform 0.1s;
  }

  .year-ctrl input[type='range']:hover::-webkit-slider-thumb {
    transform: scale(1.15);
  }

  .year-ctrl input[type='range']::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--spinner-track, rgba(0,0,0,0.12));
  }

  .year-ctrl input[type='range']::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #f46d43;
    border: none;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  }

  .theme-toggle {
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
    to { transform: rotate(360deg); }
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
    from { opacity: 0; transform: translateX(-50%) translateY(6px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
</style>
