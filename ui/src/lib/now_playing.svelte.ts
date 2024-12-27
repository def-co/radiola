import { readable, type Readable } from 'svelte/store';
import { type TStationID } from './types';
import { sleep } from './util';

type TNowPlayingData = string | [string, string] | null;
export type TNowPlaying = Readable<TNowPlayingData>;

const cache = new Map<TStationID, TNowPlaying>();
const nil: TNowPlaying = readable(null);

const DISCOVERABLE = new Set<TStationID>([
  'swh', 'swh_gold', 'swh_rock',
  'star_fm',
  'lr1', 'lr2', 'lr3', 'lr4',
  'lr_naba',
  'kurzemes', 'paradise', 'xo',
  'ehr', 'ehr_superhits', 'ehr_kh', 'ehr_summer', 'ehr_eurotop',
    'ehr_fresh', 'ehr_latv_hiti', 'ehr_top_40', 'ehr_darbam', 'ehr_ritam',
    'ehr_fitness', 'ehr_party_service', 'ehr_acoustic', 'ehr_alternative',
    'ehr_dance', 'ehr_remix', 'ehr_urban', 'ehr_love',
]);

type TSong = { title: string; artist: string };

export function nowPlayingFor(id: TStationID): TNowPlaying | null {
  let cached = cache.get(id);
  if (cached) {
    return cached;
  }

  let store = readable<TNowPlayingData>(null, (set) => {
    let hasSong = false;

    const handleSong = (ev: MessageEvent) => {
      const data = JSON.parse(ev.data) as TSong;
      set([data.artist, data.title]);
      console.log('[now_playing] %s song %o', id, data);

      if ( ! hasSong) {
        source.removeEventListener('program', handleProgram);
        hasSong = true;
      }
    };
    const handleProgram = (ev: MessageEvent) => {
      if (hasSong) {
        return;
      }
      const data = JSON.parse(ev.data) as string;
      set(data);
      console.log('[now_playing] %s program %o', id, data);
    };

    let source = new EventSource(`/discover/subscribe/${id}`);
    source.addEventListener('song', handleSong);
    source.addEventListener('program', handleProgram);

    return () => {
      source.close();
      source.removeEventListener('song', handleSong);
      source.removeEventListener('program', handleProgram);
      set(null);
    };
  });
  cache.set(id, store);
  return store;
}
