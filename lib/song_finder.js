"use strict";

const swh = require('./song_finder/swh'),
      starfm = require('./song_finder/starfm'),
      lr = require('./song_finder/lr'),
      naba = require('./song_finder/naba'),
      ehr = require('./song_finder/ehr'),
      viegli = require('./song_finder/viegli'),
      paradise = require('./song_finder/paradise'),
      kurzemes = require('./song_finder/kurzemes'),
      xo = require('./song_finder/xo');

exports.finders = {
  swh: new swh.SWHFinder(),
  swh_gold: new swh.SWHGoldFinder(),
  swh_rock: new swh.SWHRockFinder(),

  star_fm: new starfm.StarFMFinder(),

  lr1: new lr.LR1Finder(),
  lr2: new lr.LR2Finder(),
  lr3: new lr.LR3Finder(),
  lr4: new lr.LR4Finder(),

  lr_naba: new naba.NabaFinder(),

  viegli: new viegli.ViegliFinder(),
  kurzemes: new kurzemes.KurzemesFinder(),
  paradise: new paradise.ParadiseFinder(),
  xo: new xo.XoFinder(),

  ehr: new ehr.EHRFinder(),
  ehr_superhits: new ehr.EHRSuperhitsFinder(),
  ehr_kh: new ehr.EHRKHFinder(),
  ehr_fresh: new ehr.EHRFreshFinder(),
  ehr_latv_hiti: new ehr.EHRLatvHitiFinder(),
  ehr_top_40: new ehr.EHRTop40Finder(),
  ehr_love: new ehr.EHRLoveFinder(),
  ehr_darbam: new ehr.EHRDarbamFinder(),
  ehr_dance: new ehr.EHRDanceFinder(),
  ehr_acoustic: new ehr.EHRAcousticFinder(),
  ehr_summer: new ehr.EHRSummerFinder(),
  ehr_eurotop: new ehr.EHREurotopFinder(),
  ehr_ritam: new ehr.EHRRitamFinder(),
  ehr_fitness: new ehr.EHRFitnessFinder(),
  ehr_party_service: new ehr.EHRPartyServiceFinder(),
  ehr_alternative: new ehr.EHRAlternativeFinder(),
  ehr_remix: new ehr.EHRRemixFinder(),
  ehr_urban: new ehr.EHRUrbanFinder(),
};

