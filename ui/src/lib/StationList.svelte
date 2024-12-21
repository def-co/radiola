<script lang="ts">
  import { type IStation } from './types';
  import Station from './StationItem.svelte';

  interface IProps {
    stations: IStation[];
    currentStation: IStation | null;
    onselect: (station: IStation) => void;
  }

  const { stations, currentStation, onselect }: IProps = $props();

  let hasActive = $derived(currentStation !== null);
  let currentStationId = $derived(currentStation?.id ?? null);
</script>

<main>
{#each stations as station (station.id)}
  <Station
    {station}
    {hasActive}
    isActive={currentStationId === station.id}
    onselected={() => onselect(station)}
  />
{/each}
</main>

<style>
  main {
    max-width: var(--width);
    margin: 0 auto;

    display: grid;
    grid-template-columns: repeat(6, 1fr);;
    justify-content: flex-start;
    align-items: flex-start;
    gap: 0.5em;

    margin-bottom: calc(var(--player-control-height) + 1em);
  }
  main > :global(*) {
    flex: 1 1 calc(var(--width) / 6);
  }
</style>
