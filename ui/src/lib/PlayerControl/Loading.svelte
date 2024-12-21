<script lang="ts">
  import Layout from './Layout.svelte';
  import LoadingIndicator from '../LoadingIndicator.svelte';
</script>

<Layout>
  {#snippet middle()}
  <LoadingIndicator />
  {/snippet}
</Layout>
