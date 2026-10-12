// GM relay: lets a player's client ask the active GM to do something it may not do itself (create tokens, upload
// files, place walls). Built on Foundry's user queries, so the server vouches for who is asking. Handlers run on
// the GM and must check whether the requesting user is allowed.

import {HUB_ID} from "./const.js";

const QUERY = `${HUB_ID}.relay`;
const TIMEOUT = 15000;

export class Relay {
  /** @type {Map<string, Function>} name -> async (payload, user) => result */
  static #handlers = new Map();

  /**
   * Register a GM-side handler.
   * @param {string} name                                   Namespaced, e.g. "kostis-particle-effects.spawn"
   * @param {(payload: any, user: User) => any} handler     Runs on the active GM; throw to refuse
   */
  static register(name, handler) {
    this.#handlers.set(name, handler);
  }

  /** Install the query handler (once, at init). */
  static listen() {
    CONFIG.queries[QUERY] = async ({name, payload}={}, {user}={}) => {
      if ( !game.user.isGM ) throw new Error("Only a GM answers relay requests");
      const handler = this.#handlers.get(name);
      if ( !handler ) throw new Error(`no relay handler "${name}"`);
      return handler(payload, user);
    };
  }

  /**
   * Run a handler on the active GM (directly, when that is us) and resolve with its result.
   * @param {string} name
   * @param {any} payload     Must be JSON-serializable
   */
  static async call(name, payload) {
    const gm = game.users.activeGM;
    if ( !gm ) throw new Error(game.i18n.localize("KFP.Error.NoGM"));
    if ( gm.isSelf ) {
      const handler = this.#handlers.get(name);
      if ( !handler ) throw new Error(`${HUB_ID} | no relay handler "${name}"`);
      return handler(payload, game.user);
    }
    return gm.query(QUERY, {name, payload}, {timeout: TIMEOUT});
  }
}
