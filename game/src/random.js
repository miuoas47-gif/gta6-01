// A small seeded random number generator (mulberry32) plus the helpers the
// city builder and the traffic use. The same seed always gives the same city,
// the same traffic and the same screenshot scenes — nothing here reads the
// clock or Math.random, so staged scenes repeat exactly.

// Mulberry32: a tiny, well-tested seeded generator. The constants are the
// standard ones for this algorithm, written out here from its definition.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max] inclusive. */
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of an array, picked by the seeded generator. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** True with probability p (0..1). */
export function chance(rng, p) {
  return rng() < p;
}
