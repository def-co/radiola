import { type TStationID } from './types';

export type TStreamUrls = { [id: TStationID]: string };

export default <TStreamUrls>{
  "kurzemes": "http://31.170.16.6:8000/;",
  "lr1": "http://lr1mp1.latvijasradio.lv:8012/;",
  "lr2": "http://lr2mp1.latvijasradio.lv:8002/;",
  "lr3": "http://lr3mp0.latvijasradio.lv:8004/;",
  "lr4": "http://lr4mp1.latvijasradio.lv:8020/;",
  "lr_naba": "http://nabamp0.latvijasradio.lv:8016/;",
};
