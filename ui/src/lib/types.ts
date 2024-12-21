export type TStationID = string;

export interface IStation {
  id: TStationID;
  name: string;
  logoUrl: string;
  streamUrl: string;
}
