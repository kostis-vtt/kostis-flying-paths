export const HUB_ID = "kostis-flying-paths";
export const HUB_TITLE = "Kostis's Flying Paths";
export const LAYER_NAME = "kfpHub";
export const CONTROL_NAME = "kostisFlyingPaths";
export const SOCKET = `module.${HUB_ID}`;

/** Pass `{[NO_HISTORY]: true}` in a document operation's options to keep it out of the Ctrl+Z history. */
export const NO_HISTORY = "kfpNoHistory";

/** Every module of the family, whether or not it is installed. */
export const FAMILY = [
  {
    id: "kostis-actual-animator",
    title: "Kostis's Actual Animator",
    icon: "fa-solid fa-route",
    color: "#ff7a3d",
    blurb: "Draw exact motion paths and send tokens along them: curves, orbits, bounces, homing attacks, kaleidoscope copies."
  },
  {
    id: "kostis-particle-effects",
    title: "Kostis's Particle Effects",
    icon: "fa-solid fa-wand-sparkles",
    color: "#b46cff",
    blurb: "Procedural orbs, sparks, motes and auras that live on the map as tokens, with passive animation and effects to cast in one click."
  },
  {
    id: "kostis-auto-patrol",
    title: "Kostis's Auto-Patrol System",
    icon: "fa-solid fa-person-military-pointing",
    color: "#3ddc84",
    blurb: "Scans the map, builds walls and a navigation mesh, and generates patrols and guard behaviour for every NPC."
  }
];
