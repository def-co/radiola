<script lang="ts">
  import { type Snippet } from 'svelte';

  interface IProps {
    children: Snippet<[]>;
    onclick: () => void;
  }

  const { onclick, children }: IProps = $props();
</script>

<button {onclick}>
  {@render children()}
</button>

<style>
  button {
    font-size: inherit;
    background-color: rgb(0, 125, 197);
    color: white;
    border: none;
    padding: 0.5em 0.75em;
    border-radius: 0.25em;
    cursor: pointer;
  }
  button:hover {
    background-color: rgb(10, 142, 218);
  }
</style>
