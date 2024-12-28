export type TStationID = string;

export interface IStation {
  id: TStationID;
  name: string;
  logoUrl: string;
  streamUrl: string;
}

interface ILegacyStation {
  id: string;
  name: string;
  stream_mp3: string;
  logo: string;
  old_shoutcast?: true;
  hls?: string;
  stream_aac?: string;
  stream_vorbis?: string;
}

export function transform(stations: ILegacyStation[]): IStation[] {
  return stations.map((st) => {
    return {
      id: st.id,
      name: st.name,
      logoUrl: st.logo,
      streamUrl: st.stream_mp3,
    };
  });
}
