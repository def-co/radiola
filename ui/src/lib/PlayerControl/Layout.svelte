<script lang="ts">
  import { type Snippet } from 'svelte';

  interface IProps {
    left?: Snippet<[]>;
    middle?: Snippet<[]>;
    right?: Snippet<[]>;
  }
  let {
    left = empty,
    middle = empty,
    right = empty,
  } = $props();
</script>

{#snippet empty()}{/snippet}

<div class="wrapper">
  <div class="content">
    <div class="left">{@render left()}</div>
    <div class="middle">{@render middle()}</div>
    <div class="right">{@render right()}</div>
  </div>
</div>

<style>
  .wrapper {
    position: fixed;
    left: 0;
    bottom: 0;
    right: 0;

    height: var(--player-control-height);
    border-top: 1px solid gray;
    background-color: white;
    z-index: 10;

    display: flex;
    flex-flow: row nowrap;
    justify-content: center;
    align-items: stretch;
  }

  .content {
    position: relative;
    max-width: var(--width);
    height: var(--player-control-height);
    margin: 0 auto;
    flex: 1 0;

    display: grid;
    grid-template-columns: repeat(3, auto);
    align-items: center;
  }

  .middle {
    justify-self: center;
  }
  .right {
    justify-self: end;
  }
</style>
