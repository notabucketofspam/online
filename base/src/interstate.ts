import path from "node:path";
import {Router, static as serve_static, Request, Response} from "express";
import {SessionData} from "express-session";
import {GIVE_UP} from "./dmv/annapolis";
import {validProductKey} from "./dmv/authn";

const router = Router({mergeParams: true});

function give_index_html(req: Request, res: Response) {
  try {
    res.status(200).sendFile(path.join(process.cwd(), "goobo", "classic.html"));
  } catch (err) {
		GIVE_UP(res, "couldnt give html");
  }
}
function immiscible_css(req: Request, res: Response) {
  try {
    res.status(200).sendFile(path.join(process.cwd(), "goobo", "immiscible.css"));
  } catch (err) {
		GIVE_UP(res, "couldnt give css");
  }
}

router.use("/", serve_static(path.join(__dirname, "goobo")));
router.get("/immiscible.css", immiscible_css);
router.get("/", give_index_html);

export {router as rt_goobo};

// =========================
// and now it's time to copy-paste some stuff from punch.ts
import ws from "ws";
import http from "node:http";
import Stream from "node:stream";

let wss: ws.WebSocketServer;
interface Michigoner {
  user_id:number;
}
const clientMap: WeakMap<ws.WebSocket, Michigoner> = new WeakMap();

function initMichigan(server: ws.ServerOptions["server"]) {
  wss = new ws.WebSocketServer({
    server,
    host: 'localhost',
    clientTracking: true,
    autoPong: true,
    path: '/michigan'
  });
  wss.on('wsClientError', wss_onwsClientError);
  wss.on('connection', wss_onconnection);
}
function wss_onwsClientError(err: Error, socket: Stream.Duplex, request: http.IncomingMessage) {
  console.error(err, socket, request);
}
function wss_onconnection(wsConn: ws.WebSocket, req: http.IncomingMessage) {
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
              clientMap.set(wsConn, {user_id: parm.user_id});
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
    }
  } catch (err) {
		console.error(`ws_onmessage error:`, err);
  }
}
function ws_onceclose(this: ws.WebSocket, code: number, reason: Buffer) {
  const wsConn = this;
  wsConn.off('message', ws_onmessage);
  clientMap.delete(wsConn);
}
export {initMichigan};

