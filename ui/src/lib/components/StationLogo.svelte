<script module>
  import stationLogos from '../../assets/station_logos.png';
  import STATIONS from '../../assets/station_logos.manifest.json';
  import { type TStationID } from '../stations';

  const urls = new Promise<HTMLImageElement>((resolve, reject) => {
    let img = new Image();
    img.src = stationLogos;
    img.onload = () => {
      setTimeout(() => resolve(img), 3000);
    };
    img.onerror = (ev) => {
      reject();
    };
  }).then((img) => {
    let canvas = document.createElement('canvas') as HTMLCanvasElement;
    canvas.width = 200;
    canvas.height = 200;

    let ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    let urls = {} as { [id: TStationID]: string };

    for (let [i, station] of STATIONS.entries()) {
      let offset = i * 200;
      ctx.drawImage(img, offset, 0, 200, 200, 0, 0, 200, 200);
      urls[station] = canvas.toDataURL('image/png');
    }

    return urls;
  });
</script>

<script lang="ts">
  import LoadingIndicator from './LoadingIndicator.svelte';

  interface IProps {
    station: TStationID;
  }
  const { station }: IProps = $props();
</script>

{#await urls}
<div><LoadingIndicator /></div>
{:then urlsLoaded}
<img src={urlsLoaded[station]} alt="">
{/await}

<style>
  div {
    width: 100%;
    max-width: 200px;
    aspect-ratio: 1/1;

    display: flex;
    flex-flow: row nowrap;
    justify-content: center;
    align-items: center;

    background-color: #eee;
  }
</style>
