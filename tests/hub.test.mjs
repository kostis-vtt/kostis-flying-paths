// Tests for the Kostis's Flying Paths hub, run with plain Node (Foundry is mocked).
import {pathToFileURL} from "node:url";
import {dirname} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))) + "/";
let fails = 0;
const ok = (c, m) => { if ( !c ) { fails++; console.log("FAIL:", m); } else console.log("ok  :", m); };
const near = (a, b, t) => Math.abs(a - b) <= t;
const imp = f => import(pathToFileURL(ROOT + "scripts/" + f).href);

/* ---------------- Maths ---------------- */
{
  const {Rng, hash32, hashId, mulberry32} = await imp("math/rng.js");
  ok(hash32("orb") === hash32("orb") && hash32("orb") !== hash32("orc"), "hash32 is stable and discriminating");
  ok(/^[0-9a-f]{8}$/.test(hashId({a: 1})), "hashId gives 8 hex digits");
  const a = mulberry32(42); const b = mulberry32(42);
  ok([1, 2, 3, 4, 5].every(() => a() === b()), "mulberry32 is deterministic per seed");
  const r = new Rng("seed");
  let lo = Infinity, hi = -Infinity, sum = 0;
  for ( let i = 0; i < 20000; i++ ) { const v = r.next(); lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; }
  ok(lo >= 0 && hi < 1 && near(sum / 20000, 0.5, 0.01), `Rng is uniform in [0, 1) (mean ${(sum / 20000).toFixed(4)})`);
  const ints = new Set(); for ( let i = 0; i < 500; i++ ) ints.add(r.int(1, 6));
  ok(ints.size === 6 && Math.min(...ints) === 1 && Math.max(...ints) === 6, "Rng.int covers its inclusive range");
  let g = 0, g2 = 0; for ( let i = 0; i < 20000; i++ ) { const v = r.gaussian(); g += v; g2 += v * v; }
  ok(near(g / 20000, 0, 0.03) && near(Math.sqrt(g2 / 20000), 1, 0.03), "Rng.gaussian has mean 0 and sd 1");
}
{
  const {Perlin, Worley, fbm, ridged, warped} = await imp("math/noise.js");
  const p = new Perlin(7); const q = new Perlin(7); const z = new Perlin(8);
  ok(p.noise2(1.3, 2.7) === q.noise2(1.3, 2.7) && p.noise2(1.3, 2.7) !== z.noise2(1.3, 2.7), "Perlin noise is seeded");
  ok(near(p.noise2(3, 4), 0, 1e-12) && near(p.noise3(1, 2, 3), 0, 1e-12), "Perlin is zero on lattice points");
  let mn = Infinity, mx = -Infinity, smooth = true;
  for ( let i = 0; i < 4000; i++ ) {
    const x = i * 0.0137, y = i * 0.0291;
    const v = p.noise2(x, y);
    mn = Math.min(mn, v); mx = Math.max(mx, v);
    if ( Math.abs(p.noise2(x + 1e-4, y) - v) > 1e-3 ) smooth = false;
  }
  ok(mn >= -1.01 && mx <= 1.01 && mx - mn > 0.8, `Perlin stays in [-1, 1] with good spread (${mn.toFixed(2)}..${mx.toFixed(2)})`);
  ok(smooth, "Perlin is continuous");
  const n2 = (x, y) => p.noise2(x, y);
  const f = fbm(n2, 0.37, 0.91);
  const rr = ridged(n2, 0.37, 0.91);
  const w = warped(n2, 0.37, 0.91);
  ok([f, w].every(v => Number.isFinite(v) && Math.abs(v) <= 1) && rr >= 0 && rr <= 1, "fbm, ridged and warped noise are bounded");
  const wo = new Worley(3);
  const [f1, f2] = wo.sample(4.5, 2.25);
  ok(f1 <= f2 && f1 >= 0 && f1 < 1.5, "Worley returns ordered F1/F2 distances");
  ok(JSON.stringify(wo.sample(1.1, 2.2)) === JSON.stringify(new Worley(3).sample(1.1, 2.2)), "Worley is seeded");
}
{
  const c = await imp("math/color.js");
  ok(c.rgbToHex(c.hexToRgb("#ff8a1f")) === "#ff8a1f" && c.rgbToHex(c.hexToRgb("#abc")) === "#aabbcc", "hex round-trips");
  const rt = c.oklabToRgb(c.rgbToOklab(c.hexToRgb("#5b2bd6")));
  ok(c.rgbToHex(rt) === "#5b2bd6", "OKLab round-trips");
  ok(c.rgbToHex(c.mix("#000000", "#ffffff", 0)) === "#000000" && c.rgbToHex(c.mix("#000000", "#ffffff", 1)) === "#ffffff", "mix hits its ends");
  const gr = c.gradient(c.PALETTES.fire);
  ok(c.rgbToHex(gr(0)) === c.PALETTES.fire[0] && c.rgbToHex(gr(1)) === c.PALETTES.fire[3], "gradients pass through their stops");
  ok(c.rgbToNumber([1, 0.5, 0]) === 0xff8000, "rgbToNumber packs 0xRRGGBB");
  const [h, s, v] = c.rgbToHsv([0, 0, 1]);
  ok(h === 240 && s === 1 && v === 1, "rgbToHsv");
  ok(Object.values(c.PALETTES).every(p => p.length === 4 && p.every(x => /^#[0-9a-f]{6}$/.test(x))), "palettes are four valid colours each");
}

/* ---------------- Foundry mocks ---------------- */
const hooks = {};
globalThis.Hooks = {
  on: (n, f) => (hooks[n] ??= []).push(f), once: (n, f) => (hooks[n] ??= []).push(f),
  callAll: (n, ...a) => (hooks[n] ?? []).forEach(f => f(...a))
};
class Display { constructor() { this.children = []; } addChild(c) { this.children.push(c); c.parent = this; return c; } removeChildren() { this.children = []; } }
globalThis.PIXI = {Container: class extends Display { destroyed = false; }};
class PlaceablesLayer extends Display {
  history = [];
  storeHistory(type, data, options) { this._storeHistory(type, data, options); }
  _storeHistory(type, data) { if ( this.history.length >= 100 ) this.history.shift(); this.history.push({type, data}); }
  _onUndoKey() { this.undoHistory(); return true; }
  async undoHistory() { this.history.pop(); this.nativeUndos = (this.nativeUndos ?? 0) + 1; }
}
class TokenLayer extends PlaceablesLayer { storeHistory(type, data, options) { this._storeHistory(type, data, options); } }
class WallsLayer extends PlaceablesLayer {}
// Like Foundry's: its own storeHistory that calls super.storeHistory (so two guarded methods run per edit)
class RegionLayer extends PlaceablesLayer { storeHistory(type, data, options) { super.storeHistory(type, data, options); } }
const socketHandlers = [];
const emitted = [];
const me = {id: "u1", isGM: true, isSelf: true, can: () => true};
const settings = new Map([["kostis-flying-paths.assetFolder", ""]]);
const moduleObj = {id: "kostis-flying-paths", version: "1.0.0", active: true};
globalThis.foundry = {
  utils: {randomID: () => Math.random().toString(36).slice(2, 14), isSubclass: () => true},
  canvas: {layers: {
    PlaceablesLayer,
    InteractionLayer: class extends Display {
      static get layerOptions() { return {name: "", zIndex: 0}; }
      get active() { return !!this._active; }
      activate() { this._active = true; this._activate?.(); return this; }
      deactivate() { this._active = false; this._deactivate?.(); return this; }
      async _draw() {}
      async _tearDown() {}
    }
  }},
  applications: {
    api: {ApplicationV2: class { render() { this.rendered = true; return this; } _onClose() {} }, HandlebarsApplicationMixin: B => class extends B {}},
    handlebars: {loadTemplates: () => {}},
    apps: {FilePicker: {implementation: {
      calls: [],
      async createDirectory(src, path) { this.calls.push(["mkdir", path]); if ( path === "worlds" ) throw new Error("EEXIST: already exists"); },
      async browse(src, dir) { this.calls.push(["browse", dir]); return {files: [`${dir}/a.webp`, `${dir}/b%20c.webp`]}; },
      async upload(src, dir, file) { this.calls.push(["upload", dir, file.name]); return {status: "success", path: `${dir}/${file.name}`}; }
    }}},
    sidebar: {apps: {ModuleManagement: class { render() {} }}}
  }
};
globalThis.CONFIG = {Canvas: {layers: {tokens: {layerClass: TokenLayer}, walls: {layerClass: WallsLayer}, regions: {layerClass: RegionLayer}}}, queries: {}};
globalThis.game = {
  ready: false,
  user: me,
  users: {activeGM: me, get: id => (id === "u1" ? me : id === "u2" ? {id: "u2", isGM: false} : null)},
  world: {id: "my-world"},
  modules: {get: id => (id === "kostis-flying-paths" ? moduleObj : id === "kostis-actual-animator" ? {active: true, version: "1.2.0"} : null)},
  settings: {register: () => {}, get: (m, k) => settings.get(`${m}.${k}`)},
  keybindings: {register: () => {}},
  socket: {on: (n, f) => socketHandlers.push(f), emit: (n, msg) => emitted.push(msg)},
  i18n: {localize: k => k},
  activeTool: "kfpSelect"
};
globalThis.ui = {controls: {rendered: false, render: () => {}, activate: () => {}}};
globalThis.canvas = {ready: true, mousePosition: {x: 0, y: 0}};
globalThis.File = class { constructor(parts, name, opts) { this.name = name; this.type = opts?.type; } };
globalThis.Blob = class { constructor(parts, opts) { this.type = opts?.type; } };

/* ---------------- Hub ---------------- */
await imp("hub.js");
Hooks.callAll("init");
const api = game.modules.get("kostis-flying-paths").api;
ok(api && globalThis.KFP === api, "API exposed on the module and as KFP");
ok(CONFIG.Canvas.layers.kfpHub?.layerClass?.name === "KfpLayer", "shared layer registered");
let registered = null;
Hooks.on("kostisFlyingPaths.register", kfp => { registered = kfp; });
Hooks.callAll("setup");
ok(registered === api, "members get the API in the kostisFlyingPaths.register hook");

// History guard
const tl = new TokenLayer();
tl.storeHistory("create", [{_id: "a"}], {});
tl.storeHistory("create", [{_id: "b"}], {kfpNoHistory: true});
const wl = new WallsLayer();
wl.storeHistory("create", [{_id: "w"}], {kfpNoHistory: true});
wl.storeHistory("create", [{_id: "w2"}]);
ok(tl.history.length === 1 && tl.history[0].data[0]._id === "a", "token operations flagged kfpNoHistory stay out of Ctrl+Z");
ok(wl.history.length === 1 && wl.history[0].data[0]._id === "w2", "so do wall operations (generated walls)");

// Registry + controls
const clicks = [];
api.registerSubmodule({id: "kostis-particle-effects", open: () => clicks.push("open")});
api.registerTool({name: "kpeSpawn", submodule: "kostis-particle-effects", title: "Spawn", icon: "fa-solid fa-star", order: 5,
  canvas: {click: (e, p) => clicks.push(["click", p.x, p.y]), dragStart: () => clicks.push("ds"), dragDrop: (e, p) => clicks.push(["drop", p.x])}});
api.registerTool({name: "kpeStudio", submodule: "kostis-particle-effects", title: "Studio", icon: "fa-solid fa-palette", button: true, order: 1,
  onChange: () => clicks.push("studio")});
api.registerTool({name: "kapHidden", submodule: "kostis-auto-patrol", title: "Hidden", icon: "x", visible: () => false});
const {KfpLayer} = await imp("layer.js");
const control = KfpLayer.prepareSceneControls();
const names = Object.keys(control.tools);
ok(control.name === "kostisFlyingPaths" && control.layer === "kfpHub", "one shared scene-control group");
ok(names.includes("kpeSpawn") && names.includes("kpeStudio") && names.includes("kfpLauncher") && !names.includes("kapHidden"), `tools from members appear (${names.join(", ")})`);
ok(control.tools.kpeStudio.button && !control.tools.kpeSpawn.button, "buttons stay buttons, canvas tools stay tools");
control.tools.kpeStudio.onChange({}, true);
ok(clicks.includes("studio"), "button tools run their handler");
const fam = (await imp("registry.js")).Registry.family();
ok(fam.length === 3 && fam.find(f => f.id === "kostis-particle-effects").registered && fam.find(f => f.id === "kostis-actual-animator").active
  && fam.find(f => f.id === "kostis-auto-patrol").installed === false, "the launcher knows the whole family and its state");

// Input routing
const layer = new KfpLayer();
layer.activate();
game.activeTool = "kpeSpawn";
layer._onClickLeft({interactionData: {origin: {x: 12.5, y: 7}}});
ok(clicks.some(c => Array.isArray(c) && c[0] === "click" && c[1] === 12.5), "clicks reach the active member tool");
ok(layer._canDragLeftStart(me, {}) === true, "drags are allowed when the tool handles them");
layer._onDragLeftStart({interactionData: {origin: {x: 1, y: 1}}});
layer._onDragLeftDrop({interactionData: {destination: {x: 99, y: 1}}});
ok(clicks.includes("ds") && clicks.some(c => Array.isArray(c) && c[0] === "drop" && c[1] === 99), "drag start/drop are routed");
api.registerTool({name: "kpeTwice", submodule: "kostis-particle-effects", title: "Twice", icon: "x",
  canvas: {doubleClick: (e, p) => clicks.push(["double", p.x, p.y])}});
game.activeTool = "kpeTwice";
layer._onClickLeft2({interactionData: {origin: {x: 3, y: 4}}});
ok(clicks.some(c => Array.isArray(c) && c[0] === "double" && c[1] === 3 && c[2] === 4), "double-clicks are routed too");
game.activeTool = "kfpSelect";
ok(layer._canDragLeftStart(me, {}) === false, "no drag without a tool that wants it");
// Each tool hears "activate" and "deactivate" once (entering the controls reaches the layer twice)
{
  const calls = [];
  api.registerTool({name: "kapBrush", submodule: "kostis-auto-patrol", title: "Brush", icon: "x",
    canvas: {activate: () => calls.push("on:brush"), deactivate: () => calls.push("off:brush")}});
  api.registerTool({name: "kapErase", submodule: "kostis-auto-patrol", title: "Erase", icon: "x",
    canvas: {activate: () => calls.push("on:erase"), deactivate: () => calls.push("off:erase")}});
  const ctl = KfpLayer.prepareSceneControls();
  const l2 = new KfpLayer();
  globalThis.canvas.kfpHub = l2;
  game.activeTool = "kapBrush";
  l2.activate();                                        // the control's onChange
  ctl.onToolChange({}, {name: "kapBrush"}, true);       // then SceneControls reports the tool
  ok(calls.join() === "on:brush", `entering the controls activates the tool once (${calls.join()})`);
  ctl.onToolChange({}, {name: "kapBrush"}, false);
  game.activeTool = "kapErase";
  ctl.onToolChange({}, {name: "kapErase"}, true);
  ok(calls.join() === "on:brush,off:brush,on:erase", "switching tools deactivates the old one and activates the new one");
  ctl.onToolChange({}, {name: "kapErase"}, false);
  l2.deactivate();
  ok(calls.join() === "on:brush,off:brush,on:erase,off:erase", "leaving deactivates it once");
  delete globalThis.canvas.kfpHub;
  game.activeTool = "kfpSelect";
}
const o1 = layer.overlay("kpe");
ok(o1 === layer.overlay("kpe") && layer.children.includes(o1), "each member gets a persistent overlay container");

// Relay (GM side runs locally; players use an authenticated user query to the active GM)
api.relay.register("test.echo", (payload, user) => ({echo: payload, by: user.id}));
const local = await api.relay.call("test.echo", 5);
ok(local.echo === 5 && local.by === "u1", "relay runs directly on the GM");
const handler = CONFIG.queries["kostis-flying-paths.relay"];
ok(typeof handler === "function", "a user query is registered for the relay");
const player = {id: "u2", isGM: false, isSelf: true};
const queries = [];
// The handler runs on the GM's own client
const gm = {id: "g1", isGM: true, isSelf: false, query: async (name, data, opts) => {
  queries.push({name, data, opts});
  const asker = game.user;
  game.user = {id: "g1", isGM: true, isSelf: true};
  try { return await handler(data, {user: asker}); } finally { game.user = asker; }
}};
game.users.activeGM = gm;
game.user = player;
const res = await api.relay.call("test.echo", {n: 7});
ok(queries[0]?.name === "kostis-flying-paths.relay" && queries[0].data.name === "test.echo" && queries[0].opts.timeout > 0, "players query the active GM");
game.user = player;
ok(res.echo.n === 7 && res.by === "u2", "the GM's handler sees the (server-verified) requesting user");
game.user = {id: "g9", isGM: false};
let refused = null;
try { await handler({name: "test.echo", payload: 1}, {user: player}); } catch(err) { refused = err.message; }
ok(/Only a GM/.test(refused ?? ""), "non-GM clients refuse to act as the relay");
game.user = me;
try { refused = null; await handler({name: "nope"}, {user: player}); } catch(err) { refused = err.message; }
ok(/no relay handler/.test(refused ?? ""), "unknown requests are refused, not crashed");
game.users.activeGM = null;
try { refused = null; await api.relay.call("test.echo", 1); } catch(err) { refused = err.message; }
ok(refused === "KFP.Error.NoGM", "without a GM the call fails with a clear message");
game.users.activeGM = me;

// Storage
const {Storage} = await imp("storage.js");
ok(Storage.root() === "worlds/my-world/kostis-flying-paths" && Storage.dir("particles") === "worlds/my-world/kostis-flying-paths/particles", "assets live in the world folder");
const path = await Storage.upload(Storage.dir("particles"), "orb.webp", new Blob([], {type: "image/webp"}));
const fp = foundry.applications.apps.FilePicker.implementation;
ok(path === "worlds/my-world/kostis-flying-paths/particles/orb.webp", "upload returns the stored path");
ok(fp.calls.filter(c => c[0] === "mkdir").map(c => c[1]).join("|") === "worlds|worlds/my-world|worlds/my-world/kostis-flying-paths|worlds/my-world/kostis-flying-paths/particles", "folders are created level by level, tolerating existing ones");
ok(await Storage.exists(Storage.dir("x"), "b c.webp"), "listings decode file names");
// A failed upload (Foundry answers false, undefined or {}) is an error, not a path to a file that isn't there
{
  const errors = [];
  globalThis.ui.notifications = {error: m => errors.push(m), info: () => {}, warn: () => {}};
  game.i18n.format = (k, d) => `${k} ${JSON.stringify(d)}`;
  const realUpload = fp.upload;
  for ( const answer of [false, undefined, {}] ) {
    fp.upload = async () => answer;
    let threw = false;
    try { await Storage.upload(Storage.dir("particles"), "broken.webp", new Blob([], {type: "image/webp"})); } catch(err) { threw = true; }
    ok(threw && !(await Storage.exists(Storage.dir("particles"), "broken.webp")), `a failed upload (${JSON.stringify(answer) ?? "undefined"}) throws and isn't listed`);
  }
  ok(errors.length === 3 && errors[0].startsWith("KFP.Error.UploadFailed"), "and tells the user");
  fp.upload = realUpload;
}
settings.set("kostis-flying-paths.assetFolder", "/my-assets/fx/");
ok(Storage.root() === "my-assets/fx", "a custom asset folder can be configured");

// Undo history
{
  globalThis.ui.notifications = {info: () => {}, warn: () => {}};
  game.i18n.format = (k, d) => `${k} ${JSON.stringify(d)}`;
  canvas.scene = {id: "S1"};
  const log = [];
  api.history.push("first", () => log.push("first"));
  api.history.push("second", async () => log.push("second"));
  canvas.scene = {id: "S2"};
  api.history.push("elsewhere", () => log.push("elsewhere"));
  canvas.scene = {id: "S1"};
  ok(api.history.peek()?.label === "second", "steps are kept per scene");
  await api.history.undo();
  await api.history.undo();
  ok(log.join(",") === "second,first" && !api.history.peek(), "undo runs the latest step first");
  canvas.scene = {id: "S2"};
  ok(api.history.peek()?.label === "elsewhere", "and other scenes keep theirs");
  api.history.clear();
  // Ctrl+Z on the hub layer
  const hubLayer = new KfpLayer();
  canvas.scene = {id: "S1"};
  ok(hubLayer._onUndoKey({}) === false, "with nothing to undo, Ctrl+Z on the hub layer does nothing");
  api.history.push("place", () => log.push("place"));
  ok(hubLayer._onUndoKey({}) === true, "otherwise it undoes the family's latest step");
  await new Promise(r => setTimeout(r, 5));
  ok(log.at(-1) === "place", "(it ran)");
  // Token layer: whichever came last
  const tl2 = new TokenLayer();
  api.history.push("old step", () => log.push("old step"));
  await new Promise(r => setTimeout(r, 15));
  tl2.storeHistory("update", [{_id: "t", x: 1}], {});
  tl2._onUndoKey({});
  await new Promise(r => setTimeout(r, 5));
  ok(tl2.nativeUndos === 1 && log.at(-1) !== "old step", "a newer token edit is undone before an older family step");
  tl2._onUndoKey({});
  await new Promise(r => setTimeout(r, 5));
  ok(log.at(-1) === "old step", "then the family step");
  tl2.storeHistory("update", [{_id: "t", x: 2}], {});
  await new Promise(r => setTimeout(r, 15));
  api.history.push("new step", () => log.push("new step"));
  tl2._onUndoKey({});
  await new Promise(r => setTimeout(r, 5));
  ok(log.at(-1) === "new step" && tl2.nativeUndos === 1, "and a newer family step before an older token edit");
  tl2.storeHistory("update", [{_id: "t", x: 3}], {kfpNoHistory: true});
  ok(tl2.history.length === 1, "family operations never land in the layer's own history");
  // Regions: two guarded storeHistory calls per edit, and a full (100-entry) history
  const rl = new RegionLayer();
  for ( let i = 0; i < 100; i++ ) rl.storeHistory("create", [{_id: `r${i}`}], {});
  await new Promise(r => setTimeout(r, 15));
  api.history.push("family step", () => log.push("family step"));
  await new Promise(r => setTimeout(r, 15));
  rl.storeHistory("update", [{_id: "r99"}], {});
  ok(rl.history.length === 100, "(region history is full)");
  rl._onUndoKey({});
  await new Promise(r => setTimeout(r, 5));
  rl._onUndoKey({});
  await new Promise(r => setTimeout(r, 5));
  ok(rl.nativeUndos === 1 && log.at(-1) === "family step", "region edits keep their times with a full history (newest edit, then the family step)");
}

// Selection memory: Foundry releases selected tokens when our controls are activated
{
  const settle = () => new Promise(r => setTimeout(r, 1));
  const t1 = {id: "t1", isOwner: true};
  const t2 = {id: "t2", isOwner: true};
  const all = new Map([["t1", t1], ["t2", t2]]);
  canvas.scene = {id: "S1"};
  canvas.tokens = {active: true, controlled: [t1, t2], get: id => all.get(id)};
  Hooks.callAll("controlToken", t1, true);
  Hooks.callAll("controlToken", t2, true);
  await settle();
  ok(api.selection.ids().join() === "t1,t2", "the live selection");
  // The token layer is deactivated first, then everything is released
  canvas.tokens.active = false;
  canvas.tokens.controlled = [];
  Hooks.callAll("controlToken", t1, false);
  Hooks.callAll("controlToken", t2, false);
  await settle();
  ok(api.selection.ids().join() === "t1,t2", "is remembered when switching to our controls releases it");
  all.delete("t2");
  ok(api.selection.ids().join() === "t1", "deleted tokens drop out");
  canvas.scene = {id: "S2"};
  ok(api.selection.ids().length === 0, "another scene doesn't see it");
  canvas.scene = {id: "S1"};
  canvas.tokens.active = true;
  Hooks.callAll("controlToken", t1, false);
  await settle();
  canvas.tokens.active = false;
  ok(api.selection.ids().length === 0, "deselecting on the token layer clears it");
  canvas.tokens.active = true;
  canvas.tokens.controlled = [t1];
  Hooks.callAll("controlToken", t1, true);
  await settle();
  Hooks.callAll("canvasReady");
  canvas.tokens.active = false;
  canvas.tokens.controlled = [];
  ok(api.selection.ids().length === 0, "a new scene starts with nothing remembered");
}

console.log(fails ? `\n${fails} FAILURE(S)` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
