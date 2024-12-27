<script lang="ts">
  import { writable } from 'svelte/store';
  import StationList from './lib/StationList.svelte';
  import PlayerControl from './lib/PlayerControl.svelte';
  import { type IStation } from './lib/types';
  import { transform, transform as transformStations } from './lib/stations';
  import { setInstance, Player } from './lib/player.svelte';

  const player = $state(new Player());
  setInstance(player);

  let root = $state<HTMLElement>();
  $effect(() => {
    root!.appendChild(player.el);

    return () => {
      player.stop();
      root!.removeChild(player.el);
    };
  });

  const handleStationSelected = (station: IStation) => {
    player.play(station);
  };
  const handleStop = () => {
    player.stop();
  };

  const stations = fetch('/stations.json')
    .then((resp) => resp.json())
    .then(transformStations);
</script>

<div bind:this={root}>
  {#await stations}
  <PlayerControl state="loading" />
  {:then stations}
  <StationList
    {stations}
    currentStation={player.currentStation}
    onselect={handleStationSelected}
  />
  <PlayerControl state={player.currentStation ? 'playing' : 'idle'} />
  {/await}
</div>

<style>
  div {
    --width: 60rem;
    --player-control-height: 4rem;
    --gap: 0.5rem;
  }
</style>
