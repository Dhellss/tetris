(function (root) {
  'use strict';

  // Small, fast, fully deterministic PRNG. Math.random cannot be seeded,
  // and the guide lessons and tests both need a fixed piece order.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(seed) {
    const random = mulberry32(typeof seed === 'number' ? seed : 0);
    let queue = [];

    function refill() {
      const bag = Pieces.TYPES.slice();
      // Fisher-Yates, drawing from the seeded source.
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const tmp = bag[i];
        bag[i] = bag[j];
        bag[j] = tmp;
      }
      queue = queue.concat(bag);
    }

    function ensure(count) {
      while (queue.length < count) refill();
    }

    return {
      next: function () {
        ensure(1);
        return queue.shift();
      },
      peek: function (count) {
        ensure(count);
        return queue.slice(0, count);
      }
    };
  }

  root.Randomizer = {
    create: create,
    mulberry32: mulberry32
  };
})(typeof window !== 'undefined' ? window : globalThis);
