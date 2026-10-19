// Deterministic PRNG (mulberry32) so a given seed always produces the same
// sequence of values, independent of platform or Math.random.

export function createRng(seed) {
  let state = seed >>> 0;

  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng, minInclusive, maxInclusive) {
  const range = maxInclusive - minInclusive + 1;
  return minInclusive + Math.floor(rng() * range);
}
