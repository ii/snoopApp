<script context="module">
 export function preload({ params, query }) {
   const [version] = params.version;
   let [level, category, endpoint] = params.params;
   let payload = {
     version,
     level,
     category,
     endpoint
   }
   return {payload};
 }
</script>

<script>
 import { onMount, afterUpdate } from 'svelte';
 import { releasesURL } from '../../lib/constants.js';
 import {
   releases,
   activeFilters,
   activeRelease
 } from '../../store';
 import { isEmpty } from 'lodash-es';
 import Sunburst from '../../components/sunburst/Wrapper.svelte'

 export let payload;

 $: ({
   version,
   level,
   category,
   endpoint
 } = payload);

 afterUpdate(async() => {
   activeFilters.update(af => ({
     ...af,
     version,
     level: level || '',
     category: category || '',
     endpoint: endpoint || ''
   }))
   if (isEmpty($activeRelease.endpoints)) {
     let rel = await fetch(`${releasesURL}/${version}.json`).then(res => res.json());
     releases.update(rels => ({...rels, [version]: rel}));
   }
 });
</script>

<svelte:head>
  <title>APISnoop | {version}</title>
</svelte:head>

{#if $activeRelease && $activeRelease.endpoints.length > 0}
  <Sunburst />
{:else}
  <em>Loading Data...</em>
{/if}
