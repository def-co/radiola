<script lang="ts">
  import type { Component } from 'svelte';
  import Loading from './PlayerControl/Loading.svelte';
  import Idle from './PlayerControl/Idle.svelte';
  import Playing from './PlayerControl/Playing.svelte';

  interface IProps {
    state: 'loading' | 'idle' | 'playing';
  }
  let { state }: IProps = $props();

  const components: Record<IProps["state"], Component> = {
    'loading': Loading,
    'idle': Idle,
    'playing': Playing,
  };

  let ChildComponent = $derived(components[state]);
</script>

<ChildComponent />
