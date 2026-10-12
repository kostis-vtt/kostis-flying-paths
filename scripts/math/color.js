// Colour helpers: hex ⇄ RGB, sRGB ⇄ linear, OKLab mixing (perceptually even gradients) and named palettes.

const clamp01 = v => Math.min(1, Math.max(0, v));

/** "#rrggbb" (or "#rgb", or a 0xRRGGBB number) → [r, g, b] in 0..1. */
export function hexToRgb(hex) {
  if ( typeof hex === "number" ) return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  let s = String(hex ?? "").trim().replace(/^#/, "");
  if ( s.length === 3 ) s = s.split("").map(c => c + c).join("");
  if ( !/^[0-9a-f]{6}$/i.test(s) ) return [1, 1, 1];
  const n = parseInt(s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** [r, g, b] in 0..1 → "#rrggbb". */
export function rgbToHex([r, g, b]) {
  const h = v => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** [r, g, b] in 0..1 → 0xRRGGBB. */
export function rgbToNumber([r, g, b]) {
  return (Math.round(clamp01(r) * 255) << 16) | (Math.round(clamp01(g) * 255) << 8) | Math.round(clamp01(b) * 255);
}

export const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const toSrgb = c => (c <= 0.0031308 ? c * 12.92 : (1.055 * (c ** (1 / 2.4))) - 0.055);

/** sRGB [0..1] → OKLab [L, a, b]. */
export function rgbToOklab([r, g, b]) {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  const l = Math.cbrt((0.4122214708 * R) + (0.5363325363 * G) + (0.0514459929 * B));
  const m = Math.cbrt((0.2119034982 * R) + (0.6806995451 * G) + (0.1073969566 * B));
  const s = Math.cbrt((0.0883024619 * R) + (0.2817188376 * G) + (0.6299787005 * B));
  return [
    (0.2104542553 * l) + (0.7936177850 * m) - (0.0040720468 * s),
    (1.9779984951 * l) - (2.4285922050 * m) + (0.4505937099 * s),
    (0.0259040371 * l) + (0.7827717662 * m) - (0.8086757660 * s)
  ];
}

/** OKLab [L, a, b] → sRGB [0..1] (clamped). */
export function oklabToRgb([L, a, b]) {
  const l = (L + (0.3963377774 * a) + (0.2158037573 * b)) ** 3;
  const m = (L - (0.1055613458 * a) - (0.0638541728 * b)) ** 3;
  const s = (L - (0.0894841775 * a) - (1.2914855480 * b)) ** 3;
  return [
    clamp01(toSrgb((4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s))),
    clamp01(toSrgb((-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s))),
    clamp01(toSrgb((-0.0041960863 * l) - (0.7034186147 * m) + (1.7076147010 * s)))
  ];
}

/** Perceptual mix of two colours (t = 0 → a, t = 1 → b). Accepts hex strings or rgb arrays. */
export function mix(a, b, t) {
  const A = rgbToOklab(Array.isArray(a) ? a : hexToRgb(a));
  const B = rgbToOklab(Array.isArray(b) ? b : hexToRgb(b));
  return oklabToRgb([A[0] + ((B[0] - A[0]) * t), A[1] + ((B[1] - A[1]) * t), A[2] + ((B[2] - A[2]) * t)]);
}

/**
 * A smooth gradient through evenly spaced colour stops, mixed in OKLab.
 * @param {string[]} stops
 * @returns {(t:number) => number[]}   t in 0..1 → [r, g, b]
 */
export function gradient(stops) {
  const labs = (stops.length ? stops : ["#ffffff"]).map(c => rgbToOklab(hexToRgb(c)));
  return t => {
    if ( labs.length === 1 ) return oklabToRgb(labs[0]);
    const x = clamp01(t) * (labs.length - 1);
    const i = Math.min(labs.length - 2, Math.floor(x));
    const f = x - i;
    const A = labs[i];
    const B = labs[i + 1];
    return oklabToRgb([A[0] + ((B[0] - A[0]) * f), A[1] + ((B[1] - A[1]) * f), A[2] + ((B[2] - A[2]) * f)]);
  };
}

/** Relative luminance (WCAG) of an sRGB colour. */
export function luminance([r, g, b]) {
  return (0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b));
}

/** Hue (degrees), saturation and value of an sRGB colour. */
export function rgbToHsv([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if ( d > 1e-9 ) {
    if ( max === r ) h = 60 * (((g - b) / d) % 6);
    else if ( max === g ) h = 60 * (((b - r) / d) + 2);
    else h = 60 * (((r - g) / d) + 4);
  }
  return [(h + 360) % 360, max > 0 ? d / max : 0, max];
}

/** Named palettes (dark → light), shared by every Flying Paths module. */
export const PALETTES = {
  arcane: ["#1a0b3d", "#5b2bd6", "#b46cff", "#f3d9ff"],
  fire: ["#2a0500", "#c52a00", "#ff8a1f", "#fff2b0"],
  frost: ["#04142e", "#1d6fd1", "#7fd8ff", "#f2fdff"],
  void: ["#020005", "#2d0a4e", "#8a2be2", "#ff7bf2"],
  nature: ["#061a05", "#2f7d1e", "#9be05a", "#f4ffd1"],
  electric: ["#020a24", "#1f5bff", "#67e8ff", "#ffffff"],
  holy: ["#3a2600", "#d99a00", "#ffe27a", "#fffdf0"],
  poison: ["#0b1a00", "#4f9b00", "#c6ff3d", "#f6ffd6"],
  water: ["#001a2c", "#0067a3", "#3cc4e6", "#e3fbff"],
  blood: ["#1a0003", "#7a0010", "#e0213b", "#ffc2c8"],
  shadow: ["#000000", "#16141f", "#4a4560", "#a59fc4"],
  sun: ["#3d1200", "#ff6a00", "#ffd000", "#fffbe0"],
  ember: ["#120400", "#7a1c00", "#ff5a1f", "#ffd27a"],
  toxic: ["#00140c", "#00805a", "#2bffb1", "#e0fff4"],
  rose: ["#24000f", "#a3215f", "#ff6fb0", "#ffe3f0"],
  gold: ["#2b1a00", "#a46b00", "#ffc83d", "#fff6cf"]
};
