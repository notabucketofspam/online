import path from "node:path";
import {Router, static as serve_static, Request, Response} from "express";
import {SessionData} from "express-session";
import {isAuthenticated, GIVE_UP} from "./dmv/annapolis";

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
  userId?:string;
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
function wss_onconnection(wsConn: ws.WebSocket, req: Request) {
	clientMap.set(wsConn, {});
  wsConn.on('message', ws_onmessage);
  wsConn.once('close', ws_onceclose);
}
async function ws_onmessage(this: ws.WebSocket, message: ws.RawData, isBinary: boolean) {
  const wsConn = this;

	try {
  } catch (err) {
  }
}
function ws_onceclose(this: ws.WebSocket, code: number, reason: Buffer) {
  const wsConn = this;
  wsConn.off('message', ws_onmessage);
  clientMap.delete(wsConn);
}
export {initMichigan};

