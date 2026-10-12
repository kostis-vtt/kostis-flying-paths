// Undo for the whole family.
//
// Foundry records every create/update/delete the current user makes on a placeable layer in that layer's own
// Ctrl+Z history. The family's actions (painting hints, placing particles, generating walls or patrols…) keep
// their own undo steps instead, recorded here with exactly how to reverse them. Their document operations pass
// {kfpNoHistory: true}, so nothing is undone twice.
//
// Ctrl+Z undoes the latest step while the Kostis's Flying Paths controls are active. On the other layers it undoes
// whichever came last: that layer's own latest edit or the family's latest step. The apps have Undo buttons too.

import {HUB_ID, NO_HISTORY} from "./const.js";

const patched = new WeakSet();

/** When each entry of a layer's own history was recorded (kept in step with layer.history). */
const TIMES = Symbol("kfpHistoryTimes");

/** Layers whose storeHistory calls super.storeHistory (RegionLayer) go through two guards: only the outer one counts. */
let depth = 0;

function guard(proto) {
  if ( !proto || patched.has(proto) || !Object.hasOwn(proto, "storeHistory") ) return;
  const original = proto.storeHistory;
  proto.storeHistory = function(type, data, options) {
    if ( options?.[NO_HISTORY] ) return;
    if ( depth ) return original.call(this, type, data, options);
    const n0 = this.history?.length ?? 0;
    const before = this.history?.at(-1);
    let result;
    depth++;
    try {
      result = original.call(this, type, data, options);
    } finally {
      depth--;
    }
    const after = this.history?.at(-1);
    if ( after && (after !== before) ) {
      const times = (this[TIMES] ??= []);
      times.length = Math.min(times.length, n0);            // entries undone since are gone
      if ( this.history.length === n0 ) times.shift();       // the oldest entry fell off the end
      times.push(Date.now());
    }
    return result;
  };
  patched.add(proto);
}

/** When the layer's latest own history entry was recorded (0 if it has none). */
function lastOwnTime(layer) {
  const n = layer.history?.length ?? 0;
  if ( !n ) return 0;
  const times = layer[TIMES] ?? [];
  // Entries from before the module loaded count as old
  return times.length >= n ? times[n - 1] : (times.at(-1) ?? 0);
}

/** Install the guard on every layer class that keeps its own storeHistory. */
export function guardHistory() {
  const layers = foundry.canvas.layers;
  guard(layers.PlaceablesLayer?.prototype);
  for ( const cfg of Object.values(CONFIG.Canvas.layers) ) {
    let proto = cfg?.layerClass?.prototype;
    while ( proto && (proto !== Object.prototype) ) {
      guard(proto);
      proto = Object.getPrototypeOf(proto);
    }
  }
  // Ctrl+Z on a placeables layer undoes whichever is newer: its own latest edit or the family's latest step
  const P = layers.PlaceablesLayer?.prototype;
  if ( P && !patched.has(P._onUndoKey) ) {
    const original = P._onUndoKey;
    P._onUndoKey = function(event) {
      const step = UndoStack.peek();
      if ( step && (step.time >= lastOwnTime(this)) ) {
        UndoStack.undo();
        return true;
      }
      return original.call(this, event);
    };
    patched.add(P._onUndoKey);
    const originalUndo = P.undoHistory;
    P.undoHistory = async function(...args) {
      const n = this.history?.length ?? 0;
      const result = await originalUndo.apply(this, args);
      const times = this[TIMES];
      if ( times && (this.history.length < n) ) times.length = Math.min(times.length, this.history.length);
      return result;
    };
  }
}

/**
 * @typedef {object} UndoStep
 * @property {string} label          Shown to the user ("Paint floor hint")
 * @property {Function} undo         Reverses the action (may be async)
 * @property {string|null} sceneId   Steps only undo on the scene they were made on
 * @property {string} module         Which family member recorded it
 * @property {number} time
 */

export class UndoStack {
  /** @type {UndoStep[]} */
  static #steps = [];

  static LIMIT = 60;

  static #busy = false;

  /**
   * Record an undoable step.
   * @param {string} label
   * @param {Function} undo
   * @param {object} [options]
   * @param {string|null} [options.sceneId]   Defaults to the viewed scene
   * @param {string} [options.module]
   */
  static push(label, undo, {sceneId, module=HUB_ID}={}) {
    if ( typeof undo !== "function" ) return;
    this.#steps.push({label, undo, sceneId: sceneId === undefined ? (canvas?.scene?.id ?? null) : sceneId, module, time: Date.now()});
    if ( this.#steps.length > this.LIMIT ) this.#steps.shift();
    Hooks.callAll("kostisFlyingPaths.history", this.peek());
  }

  /** The step Ctrl+Z would undo right now (on the viewed scene). */
  static peek() {
    const scene = canvas?.scene?.id ?? null;
    for ( let i = this.#steps.length - 1; i >= 0; i-- ) {
      const s = this.#steps[i];
      if ( !s.sceneId || (s.sceneId === scene) ) return s;
    }
    return null;
  }

  static get size() {
    return this.#steps.length;
  }

  /** Undo the latest step on the viewed scene. Resolves with it (or null). */
  static async undo() {
    if ( this.#busy ) return null;
    const step = this.peek();
    if ( !step ) return null;
    this.#steps.splice(this.#steps.lastIndexOf(step), 1);
    this.#busy = true;
    try {
      await step.undo();
      ui.notifications?.info(game.i18n.format("KFP.Info.Undone", {label: step.label}));
    } catch(err) {
      console.error(`${HUB_ID} | undo "${step.label}"`, err);
      ui.notifications?.warn(game.i18n.format("KFP.Warn.UndoFailed", {label: step.label}));
    } finally {
      this.#busy = false;
    }
    Hooks.callAll("kostisFlyingPaths.history", this.peek());
    return step;
  }

  /** Forget a scene's steps (or everything). */
  static clear(sceneId) {
    this.#steps = sceneId ? this.#steps.filter(s => s.sceneId !== sceneId) : [];
    Hooks.callAll("kostisFlyingPaths.history", this.peek());
  }
}
