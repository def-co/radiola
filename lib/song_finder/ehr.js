"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch');

const EHR_URL = 'https://www.ehrmedijugrupa.lv/api/channel/now_playing?stream_id=';

class EHRGenericFinder extends Finder {
  constructor() {
    super();
    this.streamId = null;

    this.refreshIntervalBase = 4000;
    this.refreshIntervalJitter = 4000;
  }

  getCurrentState() {
    return fetch(EHR_URL + this.streamId)
      .then((resp) => resp.json())
      .then((data) => {
        if (data.status !== 'ok') {
          let err = new Error("Status wasn't ok");
          err.body = data;
          throw err;
        }

        let { song_artist, song_name } = data.data.pop();
        return {
          song: { artist: song_artist, title: song_name },
        };
      });
  }
}

class EHRFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 1;
  }
}

class EHRSuperhitsFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 11;
  }
}

class EHRKHFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 3;
  }
}

class EHRFreshFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 13;
  }
}

class EHRLatvHitiFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 10;
  }
}

class EHRTop40Finder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 12;
  }
}

class EHRLoveFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 26;
  }
}

class EHRDarbamFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 25;
  }
}

class EHRDanceFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 16;
  }
}

class EHRAcousticFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 18;
  }
}

class EHRSummerFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 29;
  }
}

class EHREurotopFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 14;
  }
}

class EHRRitamFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 24;
  }
}

class EHRFitnessFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 27;
  }
}

class EHRPartyServiceFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 31;
  }
}

class EHRAlternativeFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 17;
  }
}

class EHRRemixFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 15;
  }
}

class EHRUrbanFinder extends EHRGenericFinder {
  constructor() {
    super();
    this.streamId = 19;
  }
}

exports.EHRFinder = EHRFinder;
exports.EHRSuperhitsFinder = EHRSuperhitsFinder;
exports.EHRKHFinder = EHRKHFinder;
exports.EHRFreshFinder = EHRFreshFinder;
exports.EHRLatvHitiFinder = EHRLatvHitiFinder;
exports.EHRTop40Finder = EHRTop40Finder;
exports.EHRLoveFinder = EHRLoveFinder;
exports.EHRDarbamFinder = EHRDarbamFinder;
exports.EHRDanceFinder = EHRDanceFinder;
exports.EHRAcousticFinder = EHRAcousticFinder;
exports.EHRSummerFinder = EHRSummerFinder;
exports.EHREurotopFinder = EHREurotopFinder;
exports.EHRRitamFinder = EHRRitamFinder;
exports.EHRFitnessFinder = EHRFitnessFinder;
exports.EHRPartyServiceFinder = EHRPartyServiceFinder;
exports.EHRAlternativeFinder = EHRAlternativeFinder;
exports.EHRRemixFinder = EHRRemixFinder;
exports.EHRUrbanFinder = EHRUrbanFinder;
