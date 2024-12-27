<script lang="ts">
  import Layout from './Layout.svelte';
  import { nowPlayingFor } from '../now_playing.svelte';
  import { EState, getInstance } from '../player.svelte';
  import LoadingIndicator from '../components/LoadingIndicator.svelte';
  import Button from '../components/Button.svelte';
  import TextScroll from '../components/TextScroll.svelte';

  const STOP = String.fromCodePoint(0x25A0);
  const PLAY = String.fromCodePoint(0x25B6);
  const EN_DASH = String.fromCodePoint(0x2013);

  const player = getInstance();

  let station = $derived(player.currentStation!);
  let playbackState = $derived(player.state!);

  let nowPlaying = $derived(nowPlayingFor(station.id));
</script>

<Layout>
  <img src={station.logoUrl} alt="">
  <span>
    {#if playbackState === EState.BUFFERING || playbackState === EState.STALLED}
    <LoadingIndicator />
    {:else if playbackState === EState.ERROR}
    ❌
    {:else}
    {PLAY}
    {/if}
    <span class="active" class:-has-now-playing={nowPlaying && $nowPlaying}>{station.name}</span>
  </span>
  {#if nowPlaying && $nowPlaying}
  <TextScroll style="flex: 1 0 auto;">
    {#if typeof $nowPlaying === 'string'}
    <b>{$nowPlaying}</b>
    {:else}
    <b>{$nowPlaying[0]}</b> {EN_DASH} {$nowPlaying[1]}
    {/if}
  </TextScroll>
  {/if}
  <Button style="margin-left: auto;" onclick={() => player.stop()}>
    {STOP}
    Stop
  </Button>
</Layout>

<style>
  img {
    height: 3em;
    vertical-align: middle;
  }
  .active {
    font-weight: bold;
  }
  .active.-has-now-playing {
    margin-right: 1em;
  }
  @media screen and (max-width: 40rem) {
    .active.-has-now-playing {
      display: none;
    }
  }
</style>
