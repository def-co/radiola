<script lang="ts">
  import { type IStation } from './types';

  interface IProps {
    station: IStation;
    hasActive: boolean;
    isActive: boolean;
    onselected: () => void;
  }

  const {
    station,
    hasActive,
    isActive,
    onselected,
  }: IProps = $props();

  let color = $state(null);

  const onclick = () => {
    onselected();
  };
  const onkeyup = (ev: KeyboardEvent) => {
    if (ev.key === 'Enter') {
      onselected();
    }
  };
</script>

<div
  class="station"
  class:-active={isActive}
  class:-inactive={hasActive && ! isActive}
  {onclick}
  {onkeyup}
  role="button"
  tabindex="0"
>
  <img src={station.logoUrl} alt="">
  <!-- <span class="title">{station.name}</span> -->
</div>

<style>
  .station {
    display: flex;
    flex-flow: column nowrap;
    justify-content: stretch;
    align-items: center;
    max-width: 12em;

    transition:
      opacity 0.1s ease,
      filter 0.1s ease,
      transform 0.1s ease;
  }
  .station.-inactive {
    opacity: 0.8;
    filter: saturate(0.8);
    /* transform: scale(0.7); */
  }
  .station.-active {
    /* box-shadow: 0 0 0.25em 0.25em rgb(118, 4, 4); */
  }
  img {
    width: 100%;
    z-index: -1;
  }
</style>
