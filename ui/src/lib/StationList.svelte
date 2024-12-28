<script lang="ts">
  import { type IStation } from './stations';
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
    gap: var(--gap);

    margin-bottom: calc(var(--player-control-height) + 1em);
  }
  @media screen and (max-width: 50rem) {
    main {
      grid-template-columns: repeat(5, 1fr);
    }
  }
  @media screen and (max-width: 40rem) {
    main {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  @media screen and (max-width: 30rem) {
    main {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
