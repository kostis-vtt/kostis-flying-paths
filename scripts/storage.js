// Generated assets (textures, previews) are uploaded into the world folder so they travel with the world:
// worlds/<world>/kostis-flying-paths/<area>/<file>

import {HUB_ID} from "./const.js";

const FP = () => foundry.applications.apps.FilePicker.implementation;

export class Storage {
  /** Directories known to exist this session. */
  static #made = new Set();

  /** Files known to exist, per directory. */
  static #listing = new Map();

  /** The root folder for generated assets. */
  static root() {
    const custom = game.settings.get(HUB_ID, "assetFolder")?.trim().replace(/^\/+|\/+$/g, "");
    return custom || `worlds/${game.world.id}/${HUB_ID}`;
  }

  /** Full folder path for an area, e.g. dir("particles") → worlds/<world>/kostis-flying-paths/particles */
  static dir(area) {
    return area ? `${this.root()}/${area}` : this.root();
  }

  /** Create a folder (and its parents) if needed. */
  static async ensure(path) {
    const parts = path.split("/").filter(Boolean);
    let cur = "";
    for ( const part of parts ) {
      cur = cur ? `${cur}/${part}` : part;
      if ( this.#made.has(cur) ) continue;
      try {
        await FP().createDirectory("data", cur, {});
      } catch(err) {
        // Already there (the only error we expect); anything else surfaces on upload
        if ( !/EEXIST|already exists/i.test(err?.message ?? "") ) console.debug(`${HUB_ID} | createDirectory ${cur}:`, err?.message);
      }
      this.#made.add(cur);
    }
  }

  /** Names of the files in a folder (cached for the session; refreshed on demand). */
  static async list(dir, {refresh=false}={}) {
    if ( !refresh && this.#listing.has(dir) ) return this.#listing.get(dir);
    let files = new Set();
    try {
      const res = await FP().browse("data", dir);
      files = new Set((res.files ?? []).map(f => decodeURIComponent(f.split("/").pop())));
    } catch(err) {
      // Folder missing: nothing in it yet
    }
    this.#listing.set(dir, files);
    return files;
  }

  /** Does a generated file already exist? */
  static async exists(dir, name) {
    return (await this.list(dir)).has(name);
  }

  /**
   * Upload a Blob as a file. Returns its path. Requires the FILES_UPLOAD permission (use the relay otherwise).
   * @param {string} dir
   * @param {string} name
   * @param {Blob} blob
   */
  static async upload(dir, name, blob) {
    await this.ensure(dir);
    const file = new File([blob], name, {type: blob.type || "application/octet-stream"});
    const res = await FP().upload("data", dir, file, {}, {notify: false});
    // Foundry answers a failed upload with false, undefined (too large, no path) or {} (network error): only a
    // response with a path means the file is on the server
    if ( !res?.path ) {
      ui.notifications?.error(game.i18n.format("KFP.Error.UploadFailed", {path: `${dir}/${name}`}));
      throw new Error(`${HUB_ID} | upload of ${dir}/${name} failed`);
    }
    this.#listing.get(dir)?.add(name);
    return res.path;
  }

  /** Can the current user upload files? */
  static canUpload() {
    return game.user.isGM || game.user.can("FILES_UPLOAD");
  }
}
