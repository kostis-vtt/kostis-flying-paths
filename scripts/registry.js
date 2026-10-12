// Members of the family register here: an entry for the launcher and, optionally, tools in the shared
// "Kostis's Flying Paths" scene-control group.

import {FAMILY} from "./const.js";

/**
 * @typedef {object} SubmoduleDef
 * @property {string} id              The module id
 * @property {string} [title]
 * @property {string} [icon]          Font Awesome classes
 * @property {string} [color]
 * @property {string} [blurb]
 * @property {Function} [open]        Opens the module's main window
 * @property {{label:string, icon:string, run:Function, visible?:Function}[]} [actions]   Extra launcher buttons
 *                                       (`visible()` false hides one, e.g. for players)
 */

/**
 * @typedef {object} ToolDef
 * @property {string} name            Unique tool name (prefix it with your module's short name)
 * @property {string} submodule       Owning module id
 * @property {string} title
 * @property {string} icon
 * @property {number} [order]
 * @property {boolean} [button]       A one-click button (runs onChange) instead of a canvas tool
 * @property {boolean} [toggle]
 * @property {() => boolean} [active] Current state of a toggle
 * @property {() => boolean} [visible]
 * @property {Function} [onChange]
 * @property {object} [canvas]        Canvas handlers while the tool is active: click, doubleClick, rightClick,
 *                                    dragStart, dragMove, dragDrop, dragCancel, activate, deactivate (each gets
 *                                    (event, point))
 */

export class Registry {
  /** @type {Map<string, SubmoduleDef>} */
  static submodules = new Map();

  /** @type {Map<string, ToolDef>} */
  static tools = new Map();

  /** @param {SubmoduleDef} def */
  static registerSubmodule(def) {
    if ( !def?.id ) throw new Error("registerSubmodule needs an id");
    const known = FAMILY.find(f => f.id === def.id) ?? {};
    this.submodules.set(def.id, {...known, ...def});
    this.#changed();
  }

  /** @param {ToolDef} def */
  static registerTool(def) {
    if ( !def?.name ) throw new Error("registerTool needs a name");
    this.tools.set(def.name, {order: 100, ...def});
    this.#changed();
  }

  static unregisterTool(name) {
    this.tools.delete(name);
    this.#changed();
  }

  /** Tools sorted for display. */
  static sortedTools() {
    return [...this.tools.values()].sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
  }

  /** Everything the launcher shows: the whole family, with install/active state. */
  static family() {
    return FAMILY.map(f => {
      const mod = game.modules.get(f.id);
      const reg = this.submodules.get(f.id);
      return {
        ...f,
        ...(reg ?? {}),
        installed: !!mod,
        active: !!mod?.active,
        registered: !!reg,
        version: mod?.version ?? null
      };
    });
  }

  static #changed() {
    // Late registrations (after the controls were built) need a refresh
    if ( game.ready && ui.controls?.rendered ) ui.controls.render({reset: true});
  }
}
