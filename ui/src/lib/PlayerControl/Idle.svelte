<script lang="ts">
  import Layout from './Layout.svelte';
</script>

<Layout>
  {#snippet left()}
  <span>P22 Radiola</span>
  {/snippet}
  {#snippet right()}
  <span>v1.3</span>
  {/snippet}
</Layout>

<style>
  span {
    color: gray;
  }
</style>
