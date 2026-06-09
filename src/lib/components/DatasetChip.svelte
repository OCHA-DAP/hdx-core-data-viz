<script lang="ts">
  import { DOMAIN_COLORS, DOMAIN_LABELS, type Domain } from "$lib/hapi/datasets";

  interface Props {
    domain: Domain;
    label?: string;
  }

  let { domain, label }: Props = $props();
  const color = DOMAIN_COLORS[domain];
  const text = label ?? DOMAIN_LABELS[domain];
</script>

<span class="chip" style="background:{color}18; color:{color}; border-color:{color}44">
  {text}
</span>

<style>
  .chip {
    display: inline-block;
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    border: 1px solid;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
</style>
