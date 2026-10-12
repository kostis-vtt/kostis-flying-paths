// Seeded randomness: the same seed always gives the same numbers on every client.

/** 32-bit FNV-1a hash of a string (or of JSON for anything else). */
export function hash32(value) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  let h = 0x811c9dc5;
  for ( let i = 0; i < s.length; i++ ) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Short stable hex id for any value (8 hex digits). */
export function hashId(value) {
  return hash32(value).toString(16).padStart(8, "0");
}

/** Mulberry32: tiny, fast, good-quality 32-bit generator. Returns floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded random source with the usual helpers. */
export class Rng {
  constructor(seed=Date.now()) {
    this.seed = typeof seed === "number" ? seed >>> 0 : hash32(seed);
    this.next = mulberry32(this.seed);
  }

  /** Float in [min, max). */
  range(min=0, max=1) {
    return min + ((max - min) * this.next());
  }

  /** Integer in [min, max]. */
  int(min, max) {
    return min + Math.floor(this.next() * ((max - min) + 1));
  }

  /** True with probability p. */
  chance(p=0.5) {
    return this.next() < p;
  }

  pick(list) {
    return list.length ? list[Math.floor(this.next() * list.length)] : undefined;
  }

  /** Standard normal sample (Box–Muller). */
  gaussian(mean=0, sd=1) {
    const u = Math.max(1e-12, this.next());
    const v = this.next();
    return mean + (sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }

  /** Fisher–Yates shuffle (in place). */
  shuffle(list) {
    for ( let i = list.length - 1; i > 0; i-- ) {
      const j = Math.floor(this.next() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
}
