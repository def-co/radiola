<script lang="ts">
  import Layout from './Layout.svelte';
  import LoadingIndicator from '../components/LoadingIndicator.svelte';
</script>

<Layout>
  <span class="expand"></span>
  <LoadingIndicator />
  <span class="expand"></span>
</Layout>

<style>
  .expand {
    flex-grow: 1;
  }
</style>
