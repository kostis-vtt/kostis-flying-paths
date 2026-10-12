// The shared "Kostis's Flying Paths" canvas layer: one scene-control group whose tools are contributed by the
// family's modules. Canvas input is routed to whichever registered tool is active, and each module gets its own
// overlay container to draw previews into.

import {CONTROL_NAME, HUB_TITLE, LAYER_NAME} from "./const.js";
import {Registry} from "./registry.js";
import {UndoStack} from "./history.js";

export class KfpLayer extends foundry.canvas.layers.InteractionLayer {

  /** @inheritDoc */
  static get layerOptions() {
    return Object.assign(super.layerOptions, {name: LAYER_NAME, zIndex: 660});
  }

  /** @override */
  static prepareSceneControls() {
    const tools = {
      kfpSelect: {
        name: "kfpSelect", order: 0, title: "KFP.Tools.Select", icon: "fa-solid fa-arrow-pointer"
      }
    };
    for ( const t of Registry.sortedTools() ) {
      if ( t.visible && !t.visible() ) continue;
      const tool = {name: t.name, order: t.order, title: t.title, icon: t.icon};
      if ( t.button ) {
        tool.button = true;
        tool.onChange = (event, active) => t.onChange?.(event, active);
      } else if ( t.toggle ) {
        tool.toggle = true;
        tool.active = !!t.active?.();
        tool.onChange = (event, active) => t.onChange?.(event, active);
      }
      tools[t.name] = tool;
    }
    tools.kfpLauncher = {
      name: "kfpLauncher", order: 1000, title: "KFP.Tools.Launcher", icon: "fa-solid fa-feather-pointed", button: true,
      onChange: () => game.modules.get("kostis-flying-paths").api.openLauncher()
    };
    const anyForPlayers = Registry.sortedTools().some(t => !t.button && (!t.visible || t.visible()));
    return {
      name: CONTROL_NAME,
      order: 21,
      title: HUB_TITLE,
      layer: LAYER_NAME,
      icon: "fa-solid fa-feather-pointed",
      visible: game.user.isGM || anyForPlayers,
      activeTool: "kfpSelect",
      onChange: (_event, active) => {
        if ( active ) canvas[LAYER_NAME]?.activate();
      },
      onToolChange: (event, tool, active) => canvas[LAYER_NAME]?.#onToolChange(event, tool.name, active),
      tools
    };
  }

  /* -------------------------------------------- */

  /** @type {Map<string, PIXI.Container>} */
  #overlays = new Map();

  /** Overlay container for one module's previews (created on demand, drawn above the map). */
  overlay(id) {
    let c = this.#overlays.get(id);
    if ( !c || c.destroyed ) {
      c = this.addChild(new PIXI.Container());
      c.eventMode = "none";
      this.#overlays.set(id, c);
    }
    return c;
  }

  /** The registered tool that is currently active on this layer, if any. */
  get tool() {
    if ( !this.active ) return null;
    return Registry.tools.get(game.activeTool) ?? null;
  }

  /** @inheritDoc */
  async _draw(options) {
    await super._draw(options);
    this.#overlays.clear();
  }

  /** @inheritDoc */
  async _tearDown(options) {
    this.#overlays.clear();
    return super._tearDown(options);
  }

  /**
   * The registered tool whose canvas handlers are switched on. Entering the controls reaches us twice (the layer
   * activates, then SceneControls reports the tool change), and so does leaving: each tool hears it once.
   * @type {string|null}
   */
  #current = null;

  #switchTo(name, event) {
    if ( name === this.#current ) return;
    if ( this.#current ) Registry.tools.get(this.#current)?.canvas?.deactivate?.(event);
    this.#current = Registry.tools.get(name)?.canvas ? name : null;
    if ( this.#current ) Registry.tools.get(name).canvas.activate?.(event);
  }

  /** @inheritDoc */
  _activate() {
    super._activate?.();
    this.#switchTo(game.activeTool);
  }

  /** @inheritDoc */
  _deactivate() {
    super._deactivate?.();
    this.#switchTo(null);
  }

  #onToolChange(event, name, active) {
    if ( active ) {
      if ( this.active ) this.#switchTo(name, event);
    } else if ( name === this.#current ) this.#switchTo(null, event);
  }

  /* -------------------------------------------- */
  /*  Input routing                               */
  /* -------------------------------------------- */

  #point(event) {
    const o = event.interactionData?.origin ?? canvas.mousePosition;
    return {x: o.x, y: o.y};
  }

  #route(handler, event, point) {
    const fn = this.tool?.canvas?.[handler];
    if ( !fn ) return false;
    fn(event, point ?? this.#point(event));
    return true;
  }

  /** Ctrl+Z: undo the family's latest step. */
  _onUndoKey(event) {
    if ( !UndoStack.peek() ) return false;
    UndoStack.undo();
    return true;
  }

  /** @override */
  _onClickLeft(event) {
    if ( !this.#route("click", event) ) super._onClickLeft?.(event);
  }

  /** @override */
  _onClickLeft2(event) {
    if ( !this.#route("doubleClick", event) ) super._onClickLeft2?.(event);
  }

  /** @override */
  _onClickRight(event) {
    if ( !this.#route("rightClick", event) ) super._onClickRight?.(event);
  }

  /** @override */
  _canDragLeftStart(user, event) {
    return !!this.tool?.canvas?.dragStart;
  }

  /** @override */
  _onDragLeftStart(event) {
    this.#route("dragStart", event);
  }

  /** @override */
  _onDragLeftMove(event) {
    const d = event.interactionData?.destination ?? canvas.mousePosition;
    this.#route("dragMove", event, {x: d.x, y: d.y});
  }

  /** @override */
  _onDragLeftDrop(event) {
    const d = event.interactionData?.destination ?? canvas.mousePosition;
    this.#route("dragDrop", event, {x: d.x, y: d.y});
  }

  /** @override */
  _onDragLeftCancel(event) {
    this.#route("dragCancel", event);
  }
}
