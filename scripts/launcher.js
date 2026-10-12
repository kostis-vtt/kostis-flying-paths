// The "Kostis's Flying Paths" launcher: every member of the family, its state, and one-click access.

import {HUB_ID, HUB_TITLE} from "./const.js";
import {Registry} from "./registry.js";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

export class Launcher extends HandlebarsApplicationMixin(ApplicationV2) {

  static #instance = null;

  static DEFAULT_OPTIONS = {
    id: "kfp-launcher",
    classes: ["kfp-app", "kfp-launcher"],
    window: {title: HUB_TITLE, icon: "fa-solid fa-feather-pointed", resizable: true},
    position: {width: 640, height: "auto"},
    actions: {
      openMember: Launcher.#onOpen,
      runAction: Launcher.#onAction,
      manageModules: Launcher.#onManage
    }
  };

  static PARTS = {
    main: {template: `modules/${HUB_ID}/templates/launcher.hbs`}
  };

  static open() {
    this.#instance ??= new this();
    this.#instance.render({force: true});
    this.#instance.bringToFront?.();
    return this.#instance;
  }

  /** @override */
  async _prepareContext(_options) {
    const members = Registry.family().map(m => ({
      ...m,
      canOpen: m.active && (typeof m.open === "function"),
      // Index into the member's full list (the click handler looks it up there); some actions are GM-only
      actions: (m.actions ?? []).map((a, i) => ({index: i, label: a.label, icon: a.icon, show: !a.visible || a.visible()}))
        .filter(a => a.show),
      status: m.active ? (m.registered ? "ready" : "loaded") : (m.installed ? "disabled" : "missing")
    }));
    const extra = [...Registry.submodules.values()].filter(s => !members.some(m => m.id === s.id));
    return {
      version: game.modules.get(HUB_ID)?.version,
      members,
      extra,
      isGM: game.user.isGM
    };
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    Launcher.#instance = null;
  }

  static #onOpen(_event, target) {
    const def = Registry.submodules.get(target.closest("[data-member]").dataset.member);
    def?.open?.();
  }

  static #onAction(_event, target) {
    const def = Registry.submodules.get(target.closest("[data-member]").dataset.member);
    const action = def?.actions?.[Number(target.dataset.index)];
    if ( action && (!action.visible || action.visible()) ) action.run?.();
  }

  static #onManage() {
    new foundry.applications.sidebar.apps.ModuleManagement().render({force: true});
  }
}
