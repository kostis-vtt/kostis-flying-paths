// The tokens the user selected on the map. Foundry releases every selected token when another layer is activated,
// so by the time one of the family's map tools is used the selection is gone. This remembers the last selection made
// on the token layer (releases caused by switching layers are ignored; deselecting on the token layer still counts).

const state = {sceneId: null, ids: []};

function record() {
  if ( !canvas?.ready || !canvas.tokens?.active ) return;
  state.sceneId = canvas.scene?.id ?? null;
  state.ids = canvas.tokens.controlled.map(t => t.id);
}

export const Selection = {
  /**
   * The selected tokens: the live selection, or the last one made on the token layer of this scene.
   * @returns {Token[]}
   */
  tokens() {
    if ( !canvas?.ready ) return [];
    const live = canvas.tokens?.controlled ?? [];
    if ( live.length || canvas.tokens?.active ) return [...live];
    if ( state.sceneId !== canvas.scene?.id ) return [];
    return state.ids.map(id => canvas.tokens.get(id)).filter(t => t && !t.destroyed && !t.isPreview && t.isOwner);
  },

  /** Ids of the selected tokens. */
  ids() {
    return this.tokens().map(t => t.id);
  },

  /** Forget the remembered selection. */
  clear() {
    state.sceneId = null;
    state.ids = [];
  }
};

// The hook fires per token while a selection changes: read the result once it has settled
let queued = false;
Hooks.on("controlToken", () => {
  if ( queued ) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    record();
  });
});
Hooks.on("canvasReady", () => Selection.clear());
