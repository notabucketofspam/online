// Anacostia has a bunch of stuff that's used for the websocket wrt goobo
// it used to be called "interstate", but i didnt like that name as much

import http from "node:http";
import Stream from "node:stream";
import ws from "ws";
import {queryDatabase} from "../db";
import { validProductKey } from "./authn";
import { SessionData } from "express-session";

let wss: ws.WebSocketServer;
interface Michigoner {
  user_id: number;
  guilds: Set<number>;
}
const clientMap: WeakMap<ws.WebSocket, Michigoner> = new WeakMap();
const guildsWithClients: Map<number, Set<ws.WebSocket>> = new Map();

export function initAnacostia() {
  wss = new ws.WebSocketServer({
    noServer:true,
    host: 'localhost',
    clientTracking: true,
    autoPong: true,
    path: '/anacostia'
  });
  wss.on('wsClientError', wss_onwsClientError);
  wss.on('connection', wss_onconnection);
  return wss;
}

function wss_onwsClientError(err: Error, socket: Stream.Duplex, request: http.IncomingMessage) {
  console.error(err, socket, request);
}
function wss_onconnection(wsConn: ws.WebSocket, req: http.IncomingMessage) {
  // console.log(req);
  wsConn.on('message', ws_onmessage);
  wsConn.once('close', ws_onceclose);
}
async function ws_onmessage(this: ws.WebSocket, message: ws.RawData, isBinary: boolean) {
  const wsConn = this;
  try {
    if (!isBinary) {
      const rawMessage = String(message);
      const parm = JSON.parse(rawMessage);
      if (!clientMap.has(wsConn)) {
        // client is trying to authenticate
        if (parm && typeof parm === 'object') {
          if (parm.flavour === 'authn-ok'
            && typeof parm.product_key === 'string'
            && typeof parm.user_id === 'number') {
            // parm bod is ok, so now we can actually do the authn thing
            const is_valid = validProductKey(parm.user_id, parm.product_key);
            if (is_valid) {
              // add the user to the clientMap
							await smotherUserWithGlue(wsConn, parm.user_id);
              wsConn.send(JSON.stringify({flavour: 'authn-ok', user_id: parm.user_id}));
            } else {
              // invalid parmesan
            }
          } else {
            // bad parm body
          }
        } else {
          // invalid parm
        }
      } else {
        // client is already authenticated; handle other messages
      }
    } else {
      // probs a ping message
      wsConn.send(PeanutButter);
    }
		//console.log(guildsWithClients);
  } catch (err) {
		console.error(`ws_onmessage error:`, err);
  }
}
const PeanutButter = Uint8Array.from([0xA]);

function ws_onceclose(this: ws.WebSocket, code: number, reason: Buffer) {
  const wsConn = this;
  wsConn.off('message', ws_onmessage);

	// clear out all of the guilds that this user was in
  const goner = clientMap.get(wsConn);
  if (goner) {
    for (const guild_id of goner.guilds) {
      const gset = guildsWithClients.get(guild_id);
      if (gset) {
        gset.delete(wsConn);
        if (gset.size === 0) {
          // remove it if nobody's there
          guildsWithClients.delete(guild_id);
        }
      } else {
        // gset no is here
      }
    }
  } else {
    // goner is missing, so ignore pls
  }

  // get that guy outta there
  clientMap.delete(wsConn);
}

/**i'd like to give a shoutout to Micro Center*/
async function smotherUserWithGlue(wsConn: ws.WebSocket, user_id: number) {
  try {
    const sql = `SELECT guild_id FROM guild_members WHERE user_id = :user_id`;
		const params = {user_id};
    const result = await queryDatabase(sql, params);
    if (result && Array.isArray(result.rows)) {
			const guilds = new Set<number>();
      for (const row of result.rows) {
        let guild_id = 0;

        // i have no idea what Oracle is gonna give me
        if (Array.isArray(row) && row.length === 1) {
          guild_id = row[0];
        } else if (typeof row === 'number') {
          guild_id = row;
        } else if (row && typeof row === 'object' && 'guild_id' in row) {
          guild_id = Number(row.guild_id);
        } else if (typeof row === 'string') {
          guild_id = Number(row);
        }

        // add this to the user's list of guilds
				guilds.add(guild_id);

        // check the connections for the clients and the guilds
        const gset = guildsWithClients.get(guild_id);
        if (gset) {
					// add this user to the list of connected clients for this guild
          gset.add(wsConn);
        } else {
          // put 'em in the big map
          guildsWithClients.set(guild_id, new Set([wsConn]));
        }
      }

      // put the user in the clientMap
			clientMap.set(wsConn, {user_id, guilds});      
    } else {
      // theres something funky with the result
    }
  } catch (err) {
    console.error(err);
  }
}

export function miracast(guild_id: number, letter: any) {
  try {
    const someclients = guildsWithClients.get(guild_id);
    if (someclients) {
			const JayLeno = JSON.stringify(letter);
      for (const client of someclients) {
        if (client.readyState === ws.WebSocket.OPEN) {
          client.send(JayLeno);
        }
      }
    } else {
      // ah, looks like theres no clients
    }
  } catch (err) {
    console.error(err);
  }
}
