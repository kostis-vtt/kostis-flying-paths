// Gradient noise for procedural images: seeded Perlin noise (2D/3D), fractal sums, ridges, domain warping and
// cellular (Worley) noise. Everything is deterministic for a given seed.

import {mulberry32} from "./rng.js";

const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
]);

const fade = t => t * t * t * ((t * ((t * 6) - 15)) + 10);
const lerp = (a, b, t) => a + ((b - a) * t);

/** Seeded improved Perlin noise. Output is roughly in [-1, 1]. */
export class Perlin {
  constructor(seed=0) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for ( let i = 0; i < 256; i++ ) p[i] = i;
    for ( let i = 255; i > 0; i-- ) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    this.mod12 = new Uint8Array(512);
    for ( let i = 0; i < 512; i++ ) {
      this.perm[i] = p[i & 255];
      this.mod12[i] = this.perm[i] % 12;
    }
  }

  noise2(x, y) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const xf = x - X;
    const yf = y - Y;
    const xi = X & 255;
    const yi = Y & 255;
    const P = this.perm;
    const M = this.mod12;
    const g = (h, dx, dy) => (GRAD3[h * 3] * dx) + (GRAD3[(h * 3) + 1] * dy);
    const aa = M[xi + P[yi]];
    const ab = M[xi + P[yi + 1]];
    const ba = M[xi + 1 + P[yi]];
    const bb = M[xi + 1 + P[yi + 1]];
    const u = fade(xf);
    const v = fade(yf);
    const x1 = lerp(g(aa, xf, yf), g(ba, xf - 1, yf), u);
    const x2 = lerp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  noise3(x, y, z) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const Z = Math.floor(z);
    const xf = x - X;
    const yf = y - Y;
    const zf = z - Z;
    const xi = X & 255;
    const yi = Y & 255;
    const zi = Z & 255;
    const P = this.perm;
    const M = this.mod12;
    const g = (h, dx, dy, dz) => (GRAD3[h * 3] * dx) + (GRAD3[(h * 3) + 1] * dy) + (GRAD3[(h * 3) + 2] * dz);
    const h = (i, j, k) => M[i + P[j + P[k]]];
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);
    const n000 = g(h(xi, yi, zi), xf, yf, zf);
    const n100 = g(h(xi + 1, yi, zi), xf - 1, yf, zf);
    const n010 = g(h(xi, yi + 1, zi), xf, yf - 1, zf);
    const n110 = g(h(xi + 1, yi + 1, zi), xf - 1, yf - 1, zf);
    const n001 = g(h(xi, yi, zi + 1), xf, yf, zf - 1);
    const n101 = g(h(xi + 1, yi, zi + 1), xf - 1, yf, zf - 1);
    const n011 = g(h(xi, yi + 1, zi + 1), xf, yf - 1, zf - 1);
    const n111 = g(h(xi + 1, yi + 1, zi + 1), xf - 1, yf - 1, zf - 1);
    return lerp(lerp(lerp(n000, n100, u), lerp(n010, n110, u), v), lerp(lerp(n001, n101, u), lerp(n011, n111, u), v), w);
  }
}

/**
 * Fractal Brownian motion: several octaves of noise, each finer and fainter. Output roughly in [-1, 1].
 * @param {(x:number, y:number) => number} fn
 */
export function fbm(fn, x, y, {octaves=5, lacunarity=2, gain=0.5}={}) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for ( let o = 0; o < octaves; o++ ) {
    sum += amp * fn(x * f, y * f);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** Ridged fractal noise (sharp crests, like veins or lightning). Output in [0, 1]. */
export function ridged(fn, x, y, {octaves=5, lacunarity=2, gain=0.5}={}) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  let prev = 1;
  for ( let o = 0; o < octaves; o++ ) {
    let n = 1 - Math.abs(fn(x * f, y * f));
    n *= n;
    sum += n * amp * prev;
    norm += amp;
    prev = n;
    amp *= gain;
    f *= lacunarity;
  }
  return Math.min(1, sum / norm);
}

/** Domain-warped fractal noise: noise looked up through noise, for swirling, marbled shapes. */
export function warped(fn, x, y, {strength=1.5, octaves=4}={}) {
  const qx = fbm(fn, x, y, {octaves});
  const qy = fbm(fn, x + 5.2, y + 1.3, {octaves});
  return fbm(fn, x + (strength * qx), y + (strength * qy), {octaves});
}

/** Seeded cellular (Worley) noise: distance to the nearest and second-nearest feature point. */
export class Worley {
  constructor(seed=0) {
    this.seed = seed >>> 0;
  }

  #cellPoint(ix, iy) {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ this.seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    const a = (h >>> 0) / 4294967296;
    h = Math.imul(h ^ 0x9e3779b9, 1274126177);
    h ^= h >>> 15;
    const b = (h >>> 0) / 4294967296;
    return [ix + a, iy + b];
  }

  /** @returns {[number, number]}  F1 and F2 distances */
  sample(x, y) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    let f1 = Infinity;
    let f2 = Infinity;
    for ( let j = -1; j <= 1; j++ ) {
      for ( let i = -1; i <= 1; i++ ) {
        const [px, py] = this.#cellPoint(X + i, Y + j);
        const d = Math.hypot(px - x, py - y);
        if ( d < f1 ) {
          f2 = f1;
          f1 = d;
        } else if ( d < f2 ) f2 = d;
      }
    }
    return [f1, f2];
  }
}
