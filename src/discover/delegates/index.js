'use strict';

const SWHDelegates = require('./swh'),
      Pieci = require('./pieci'),
      EHR = require('./ehr'),
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

  Pieci, EHR, Naba,

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
      case 'pieci_ziemassvetki':
        return 'Pieci';

      case 'ehr':
        return 'EHR';

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
