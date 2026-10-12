// Kostis's Flying Paths — the hub that ties the family together.
//
// Members register in the "kostisFlyingPaths.register" hook (fired once during setup):
//   Hooks.once("kostisFlyingPaths.register", kfp => {
//     kfp.registerSubmodule({id: "my-module", open: () => ...});
//     kfp.registerTool({name: "myTool", submodule: "my-module", title: "...", icon: "...", canvas: {click: (e, p) => ...}});
//   });

import {CONTROL_NAME, FAMILY, HUB_ID, HUB_TITLE, LAYER_NAME, NO_HISTORY} from "./const.js";
import {Registry} from "./registry.js";
import {Relay} from "./relay.js";
import {Storage} from "./storage.js";
import {UndoStack, guardHistory} from "./history.js";
import {KfpLayer} from "./layer.js";
import {Launcher} from "./launcher.js";
import {Selection} from "./selection.js";
import {Rng, hash32, hashId, mulberry32} from "./math/rng.js";
import {Perlin, Worley, fbm, ridged, warped} from "./math/noise.js";
import * as color from "./math/color.js";

const api = {
  id: HUB_ID,
  title: HUB_TITLE,
  family: FAMILY,
  /** Pass `{[api.NO_HISTORY]: true}` in document operation options to keep them out of Ctrl+Z. */
  NO_HISTORY,
  LAYER_NAME,
  CONTROL_NAME,
  registerSubmodule: def => Registry.registerSubmodule(def),
  registerTool: def => Registry.registerTool(def),
  unregisterTool: name => Registry.unregisterTool(name),
  /** The shared canvas layer (null before the canvas is ready). */
  get layer() {
    return canvas?.[LAYER_NAME] ?? null;
  },
  /** Activate the shared layer with one of the registered tools. */
  activateTool(name) {
    if ( !canvas?.ready ) return;
    ui.controls.activate({control: CONTROL_NAME, tool: name});
  },
  openLauncher: () => Launcher.open(),
  relay: {
    register: (name, handler) => Relay.register(name, handler),
    call: (name, payload) => Relay.call(name, payload)
  },
  storage: Storage,
  /**
   * The tokens selected on the map. Foundry releases them when our controls are activated, so tools that act on
   * "the selected tokens" use this: the live selection, or the last one made on the token layer.
   * @example const caster = KFP.selection.tokens()[0];
   */
  selection: Selection,
  /**
   * The family's undo history (Ctrl+Z on the Kostis's Flying Paths controls).
   * @example KFP.history.push("Place 3 orbs", () => scene.deleteEmbeddedDocuments("Token", ids, {kfpNoHistory: true}))
   */
  history: {
    push: (label, undo, options) => UndoStack.push(label, undo, options),
    undo: () => UndoStack.undo(),
    peek: () => UndoStack.peek(),
    clear: sceneId => UndoStack.clear(sceneId)
  },
  math: {Rng, hash32, hashId, mulberry32, Perlin, Worley, fbm, ridged, warped, color}
};

Hooks.once("init", () => {
  game.modules.get(HUB_ID).api = api;
  globalThis.KFP = api;

  game.settings.register(HUB_ID, "assetFolder", {
    name: "KFP.Settings.AssetFolder.Name",
    hint: "KFP.Settings.AssetFolder.Hint",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });

  game.keybindings.register(HUB_ID, "openLauncher", {
    name: "KFP.Keybindings.OpenLauncher",
    editable: [],
    onDown: () => {
      Launcher.open();
      return true;
    }
  });

  CONFIG.Canvas.layers[LAYER_NAME] = {layerClass: KfpLayer, group: "interface"};
  Relay.listen();
  foundry.applications.handlebars.loadTemplates([`modules/${HUB_ID}/templates/launcher.hbs`]);
});

Hooks.once("setup", () => {
  guardHistory();
  Hooks.callAll("kostisFlyingPaths.register", api);
});

