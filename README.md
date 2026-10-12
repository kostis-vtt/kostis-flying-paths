# Kostis's Flying Paths

[![Latest release](https://img.shields.io/github/v/release/kostis-vtt/kostis-flying-paths?label=release)](https://github.com/kostis-vtt/kostis-flying-paths/releases/latest) ![Foundry v14](https://img.shields.io/badge/Foundry-v14-orange) [![Downloads](https://img.shields.io/github/downloads/kostis-vtt/kostis-flying-paths/total)](https://github.com/kostis-vtt/kostis-flying-paths/releases) [![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-support-ff5e5b?logo=ko-fi&logoColor=white)](https://ko-fi.com/xgpro)

The hub of a family of Foundry VTT modules:

| Module | What it does |
|---|---|
| **Kostis's Actual Animator** | Draw exact motion paths and send tokens along them: curves, orbits, bounces, homing attacks, kaleidoscope copies. |
| **Kostis's Particle Effects** | Procedural orbs, sparks, motes, flames, crystals, runes, portals, shields and auras as real tokens with live animated looks, plus emitters and one-click effects. |
| **Kostis's Auto-Patrol System** | Scans the map, builds walls and a navigation mesh, and generates patrols and guard behaviour for NPCs. |

Each member is a separate module, so you enable only what you need. Particle Effects and Auto-Patrol require this hub; the Animator works on its own and joins the hub when it is enabled.

## Installation

In Foundry, go to *Add-on Modules → Install Module*, paste this manifest URL and press *Install*:

`https://github.com/kostis-vtt/kostis-flying-paths/releases/latest/download/module.json`

The family's other modules each have their own manifest URL (see their pages); installing one of them brings this hub along.

## What the hub provides

- **Launcher**: the feather button at the end of the *Kostis's Flying Paths* scene controls, or a keybinding (Configure Controls → *Open Kostis's Flying Paths*). It lists every member, whether it is installed and enabled, and opens each one.
- **Shared scene controls**: one *Kostis's Flying Paths* group where members add their map tools.
- **GM relay**: players' clients can ask the GM to do what they may not (create tokens, upload images). Built on Foundry's authenticated user queries.
- **Asset storage**: generated images go to `worlds/<world>/kostis-flying-paths/` (change it in the module settings).
- **Selection memory**: Foundry deselects your tokens when you switch to another set of controls. The hub remembers the tokens you last selected on the token layer, so the family's tools that act on "the selected token" (casting, auras, patrols for the selected NPCs) still know which one you meant.
- **Undo**: one history for the whole family. Ctrl+Z on the Kostis's Flying Paths controls undoes the latest step (a painted hint, placed particles, generated walls…). On the token or walls layer it undoes whichever came last, your own edit or the family's step. Members' apps have Undo buttons too.
- **Procedural maths**: seeded random numbers, Perlin/fractal/warped/cellular noise and OKLab colour mixing for members and macros (`KFP.math`).

## For developers

```js
Hooks.once("kostisFlyingPaths.register", kfp => {
  kfp.registerSubmodule({id: "my-module", open: () => new MyApp().render(true)});
  kfp.registerTool({
    name: "myTool", submodule: "my-module", title: "Do the thing", icon: "fa-solid fa-star",
    canvas: {click: (event, point) => console.log(point)}
  });
  kfp.relay.register("my-module.doIt", (payload, user) => { /* runs on the GM; check `user` */ });
});
await KFP.relay.call("my-module.doIt", {some: "data"});
await KFP.storage.upload(KFP.storage.dir("my-module"), "image.webp", blob);
KFP.history.push("Place 3 orbs", () => scene.deleteEmbeddedDocuments("Token", ids, {[KFP.NO_HISTORY]: true}));
KFP.selection.tokens();     // the selected tokens (still known after switching to the Kostis's Flying Paths controls)
await scene.createEmbeddedDocuments("Token", data, {[KFP.NO_HISTORY]: true});
```

## Support

Found a bug? [Report it](https://github.com/kostis-vtt/kostis-flying-paths/issues/new/choose). For questions, ideas, or to show what you made with it, head to [Discussions](https://github.com/kostis-vtt/kostis-flying-paths/discussions).

These modules are free. If you enjoy them, you can support their development on [Ko-fi](https://ko-fi.com/xgpro).

## Licence

MIT: see [LICENSE](LICENSE).

## Development

The tests run with plain Node, with Foundry mocked: run each file in `tests/` with `node` (for example
`node tests/hub.test.mjs`). Some load Handlebars and PIXI from a local Foundry install: set `FOUNDRY_APP` to its `resources/app`
folder if Foundry isn't installed in `C:/Program Files/Foundry Virtual Tabletop`. The family's other modules are
expected in folders next to this one.

To release a version: set it in `module.json`, add a `## <version>` section to `CHANGELOG.md`, commit, and push a tag
`v<version>`. GitHub Actions builds `module.zip` and publishes the release. The manifest URL of the latest version is
`https://github.com/kostis-vtt/kostis-flying-paths/releases/latest/download/module.json`.
