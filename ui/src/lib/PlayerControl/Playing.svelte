<script lang="ts">
  import Layout from './Layout.svelte';
  import { nowPlayingFor } from '../now_playing.svelte';
  import { EState, getInstance } from '../player.svelte';
  import LoadingIndicator from '../LoadingIndicator.svelte';

  const STOP = String.fromCodePoint(0x25A0);
  const PLAY = String.fromCodePoint(0x25B6);

  const player = getInstance();

  let station = $derived(player.currentStation!);
  let playbackState = $derived(player.state!);

  let nowPlaying = $derived(nowPlayingFor(station.id));
</script>

<Layout>
  {#snippet left()}
    <img src={station.logoUrl} alt="">
    {#if playbackState === EState.BUFFERING || playbackState === EState.STALLED}
    <LoadingIndicator />
    {:else if playbackState === EState.ERROR}
    ❌
    {:else}
    {PLAY}
    {/if}
    <span class="active">{station.name}</span>
    {#if nowPlaying && $nowPlaying}
    <span class="now-playing">{$nowPlaying}</span>
    {/if}
  {/snippet}
  {#snippet right()}
    <button onclick={() => player.stop()}>
      {STOP}
      Stop
    </button>
  {/snippet}
</Layout>

<style>
  img {
    height: 3em;
    vertical-align: middle;
  }
  .active {
    font-weight: bold;
  }
  .now-playing {
    margin-left: 1em;
  }

  button {
    font-size: 1em;
    background-color: rgb(0, 125, 197);
    color: white;
    border: none;
    padding: 0.5em 0.75em;
    border-radius: 0.25em;
    cursor: pointer;
  }
</style>
