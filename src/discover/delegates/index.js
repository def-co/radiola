'use strict';

const SWHDelegates = require('./swh'),
      Pieci = require('./pieci'),
      EHR = require('./ehr')

let Delegates = module.exports = {
  SWH: SWHDelegates.SWH,
  SWHGold: SWHDelegates.SWHGold,
  SWHRock: SWHDelegates.SWHRock,

  Pieci, EHR,

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

      default:
        return null;
    }
  }
}
