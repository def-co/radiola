<script lang="ts">
  import { type Snippet } from 'svelte';

  interface IProps {
    children: Snippet<[]>;
  }
  const { children }: IProps = $props();
</script>

<div class="wrapper">
  <div class="content">
    {@render children()}
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
    width: var(--width);
    height: var(--player-control-height);
    margin: 0 auto;
    padding: 0 var(--gap);

    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    gap: var(--gap);

    text-wrap: nowrap;
  }
</style>
