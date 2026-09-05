import path from "node:path";
import {Router, static as serve_static, Request, Response} from "express";
import {SessionData} from "express-session";
import {isAuthenticated, GIVE_UP} from "./dmv/annapolis";

const router = Router({mergeParams: true});

function give_index_html(req: Request, res: Response) {
  try {
    const the_index = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <link rel="stylesheet" type="text/css" href="/css/great-scott.css" />
          <meta name="viewport" content="width=device-width, user-scalable=yes" />
          <title>Goobo Jr. - waluigi-servebeer.com</title>
        </head>
        <body>
          <h1>Goobo Jr.</h1>
          <div id="goobo-root"></div>
          <script src="/js/everything.js"></script>
          <script src="/goobo/detroit.js" type="module"></script>
        </body>
      </html>
    `;
    res.status(200).send(the_index);
  } catch (err) {
		GIVE_UP(res, "couldnt give html");
  }
}

router.use("/", serve_static(path.join(__dirname, "goobo")));
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

