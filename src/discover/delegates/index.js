'use strict';

const SWHDelegates = require('./swh'),
      Pieci = require('./pieci'),
      EHRDelegates = require('./ehr'),
      LRDelegates = require('./lr'),
      Naba = require('./naba')

let Delegates = module.exports = {
  SWH: SWHDelegates.SWH,
  SWHGold: SWHDelegates.SWHGold,
  SWHRock: SWHDelegates.SWHRock,

  LR1: LRDelegates.LR1,
  LR2: LRDelegates.LR2,
  LR3: LRDelegates.LR3,
  LR4: LRDelegates.LR4,

  Pieci, Naba,

  EHR: EHRDelegates.EHR,
  EHRSuperhits: EHRDelegates.EHRSuperhits,
  // EHRKH: EHRDelegates.EHRKH,
  EHRFresh: EHRDelegates.EHRFresh,
  EHRLatvHiti: EHRDelegates.EHRLatvHiti,
  EHRTop40: EHRDelegates.EHRTop40,
  EHRLove: EHRDelegates.EHRLove,
  EHRDarbam: EHRDelegates.EHRDarbam,
  EHRDance: EHRDelegates.EHRDance,
  EHRAcoustic: EHRDelegates.EHRAcoustic,


  findAppointedDelegate: (station) => {
    switch (station) {
      case 'swh':
        return 'SWH';

      case 'swh_gold':
        return 'SWHGold';

      case 'swh_rock':
        return 'SWHRock';

      case 'pieci_koncerti':
      case 'pieci_atklajumi':
      case 'pieci_latviesi':
      case 'pieci_hiti':
      case 'pieci':
      // case 'pieci_100':
      // case 'pieci_ziemassvetki':
        return 'Pieci';

      case 'ehr':
        return 'EHR';
      case 'ehr_superhits':
        return 'EHRSuperhits';
      // case 'ehr_kh':
      //   return 'EHRKH';
      case 'ehr_fresh':
        return 'EHRFresh';
      case 'ehr_latv_hiti':
        return 'EHRLatvHiti';
      case 'ehr_top_40':
        return 'EHRTop40';
      case 'ehr_love':
        return 'EHRLove';
      case 'ehr_darbam':
        return 'EHRDarbam';
      case 'ehr_dance':
        return 'EHRDance';
      case 'ehr_acoustic':
        return 'EHRAcoustic';

      case 'lr1':
        return 'LR1';
      case 'lr2':
        return 'LR2';
      case 'lr3':
        return 'LR3';
      case 'lr4':
        return 'LR4';

      case 'lr_naba':
        return 'Naba';

      default:
        return null;
    }
  }
}
