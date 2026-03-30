/*
This is some server-side stuff for WebSockets. A lot of this is copied straight
from Egg/Oracle, so it still needs a bit of refactoring.

The eventual goal is to reduce the number of times we gotta write to the
Oracle ADB. The WS connection is kinda just here as a keep-alive;
when the connection ends, all the user's changes will be committed to the DB.
*/

/**
 * Metadata about a WebSocket client
 */
export type ClientMeta = {
  isAlive: boolean,
  game?: string,
  user?: string
};

import * as ws from 'ws';

/**
 * Wrapper for WebSocketServer with browser-compatible ping-pong
 */
export default class ExtWSS extends ws.WebSocketServer {
  private pingFrame = Uint8Array.from([0x9]);
  private pongFrame = Uint8Array.from([0xA]);
  aliveClients: Map<ws.WebSocket, ClientMeta>;
  private pingTimer: NodeJS.Timeout;


  constructor(options?: ws.ServerOptions, callback?: () => void) {
    super(options, callback);
    this.aliveClients = new Map();

    // pingTimer
    this.pingTimer = setInterval(() => {
      for (const [client, clientMeta] of this.aliveClients.entries()) {
        if (!clientMeta.isAlive) {
          client.off("message", () => void 0);
          client.off("close", () => void 0);
          client.terminate();
          this.aliveClients.delete(client);
          continue;
        }
        this.aliveClients.get(client)!.isAlive = false;
        client.send(this.pingFrame);
      }
    }, 30000); // end pingTimer


    // onconnection
    this.on("connection", (client, request) => {
      this.aliveClients.set(client, { isAlive: true });


      client.on("message", (data, isBinary) => {
        if (isBinary && (data as Buffer).length === 1 && (data as Buffer)[0] === this.pongFrame[0]) {
          this.aliveClients.get(client)!.isAlive = true;
        } else {
          this.emit("message", client, data, isBinary);
        }
      });


      client.once("close", () => {
        client.off("message", () => void 0);
        this.aliveClients.delete(client);
      });

    }); // end onconnection


  } // end constructor


  terminate() {
    clearInterval(this.pingTimer);
    for (const client of this.clients) {
      client.off("message", () => void 0);
      client.off("close", () => void 0);
      client.terminate();
    }
    this.aliveClients.clear();
    this.off("connection", () => void 0);
    this.close();
  }

}

const wss = new ws.WebSocketServer({ port: 39601 });
