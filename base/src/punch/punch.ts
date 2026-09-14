// all sorts of imports
import Stream from 'node:stream';
import http from 'node:http';
import net from "node:net";

import { Request } from 'express';
import ws from 'ws';

import * as odb from "../db";
import { redisStore } from "../express_app";
import { rsPort, theWsbcUdpRelay } from './udp';
import {
	generatePunchSku,
	getPunchBySku,
	getWsClientByPunchSku,
	performJunction,
	generateClientBarcode
} from "./fn_punch"; 

import {
	Punch,
	ClientData,
	WsbcReply,
	WsEventData,
	WsPair,
	PkeyInfo
} from "VocabQuiz";
import {SessionData} from "express-session";

/**temporarily remember the WebSockets involved in the punch port peer pairing process*/
const joinMap: Map<string, WsPair> = new Map();

// ===========================================================
// websocket server

let wss: ws.WebSocketServer;

const clientMap: WeakMap<ws.WebSocket, ClientData> = new WeakMap();
const peerAddrMap: WeakMap<ws.WebSocket, string> = new WeakMap();

// we don't need the server returned by app.listen()
function initWSS () {
	wss = new ws.WebSocketServer({
		noServer: true,
		host: 'localhost',
		clientTracking: true,
		autoPong: true,
		path: '/wss'
	});
	wss.on('wsClientError', wss_onwsClientError);
	wss.once('listening', wss_oncelistening);
	wss.on('connection', wss_onconnection);
	return wss;
}

function wss_oncelistening(){
	console.log('WSS OK', wss.address());
}

function wss_onconnection (wsConn : ws.WebSocket, req : Request) {
	const xff = req.headersDistinct['x-forwarded-for']?.at(0);
	const addr = xff??'';

	peerAddrMap.set(wsConn, addr);

	wsConn.on('message', ws_onmessage);
	wsConn.once('close', ws_onceclose);
}

async function ws_onmessage (this: ws.WebSocket,message : ws.RawData, isBinary: boolean){
	const wsConn = this;
	const addr = peerAddrMap.get(wsConn) ?? '';

	try {
		if (!isBinary) {
			const rawMessage = message.toString();
			const parsedMessage = JSON.parse(rawMessage);
			if (!clientMap.has(wsConn)) {
				// client wishes to set either the session or the product key

				if (typeof parsedMessage['pkey'] === 'string'
					&& typeof parsedMessage['email'] === 'string') {
					// client wants to set the product key
					const pkeyInfo: PkeyInfo = {
						pkey: parsedMessage['pkey'],
						email: parsedMessage['email'],
						username: '',
						userId: 0
					};
					// handle product key
					const userResult = await odb.getUserByEmail(pkeyInfo.email);
					if (userResult !== null) {
						// user is real
						pkeyInfo.username = userResult.USERNAME;
						pkeyInfo.userId = userResult.USERID;

						// now we check if his product key is registered under his name
						const pkeysRes = await odb.getPkeys(pkeyInfo.userId);
							if (pkeysRes !== null){
							// pkeys is real

							// so now we check if it's actually his
							if (Object.keys(pkeysRes).includes(pkeyInfo.pkey)) {
								// the product key belongs to him

								// everything checks out, so we can add this guy to the clientMap
									const services : Punch[] = [];
								const userId = pkeyInfo.userId;
								const username = pkeyInfo.username;
									const clientData: ClientData = {pkeyInfo, services, addr, userId, username};
								clientData.barcode = generateClientBarcode(clientData);
								clientMap.set(wsConn, clientData);
								// console.log(`User ${pkeyInfo.username} authenticated successfully with product key ${pkeyInfo.pkey}`);
								wsConn.send(JSON.stringify({flavour:"authn-ok"}));
							} else {
								// this is not your product key
								console.error(`User ${pkeyInfo.username} attempted to authenticate with invalid product key ${pkeyInfo.pkey}`);
							}
						} else {
							// pkeys is null
							console.error(`Database error when fetching product keys for user ${pkeyInfo.username}`);
						}
					} else {
						// user result was null
						console.error(`No user found with email ${pkeyInfo.email} when attempting to authenticate with product key ${pkeyInfo.pkey}`);
					}
				} else if (typeof parsedMessage['Cookie'] === 'string') {
					// client wants to set the session id
					let sid: string = parsedMessage['Cookie'];
					if (sid.includes('connect.sid=')){
						sid = sid.replace('connect.sid=','');
					}
					sid = decodeURIComponent(sid);
					const rx = /s:(.*?)\./;
					sid = rx.exec(sid)?.[1] ?? sid;
					const session: SessionData | undefined = await redisStore.get(sid);
					const userId = session?.userId ?? 0;
					const username = session?.username ?? '';
					const services: Punch[] = [];
						const clientData: ClientData = {sid, services, addr, userId, username};
					clientData.barcode = generateClientBarcode(clientData);
					clientMap.set(wsConn, clientData);
					// console.log(`Client with IP ${addr} authenticated with session ID ${sid}`);
					wsConn.send(JSON.stringify({flavour: "authn-ok"}));
				} else {
					// the request doesn't include sid or pkey et al.
					console.error('Received invalid authentication message from client:', parsedMessage);
				}
			} else if (typeof parsedMessage['request_id'] === 'string'
				&& typeof parsedMessage['flavour'] === 'string'
				&& typeof parsedMessage['punch_port'] === 'number' ) {
				// client is doing the join handshake thing
				const ev_data: WsbcReply = parsedMessage;
					const {request_id, flavour, punch_port} = ev_data;
				console.log("ws_onmessage", ev_data);
				const wsPair = joinMap.get(request_id);
				if (typeof wsPair !== 'undefined') {
						const {wsClient, wsServer, wsMeta} = wsPair;
					if (flavour === 'client-open') {
						// client has opened the udp socket

						// we may already have the client's UDP port, thanks to grandFacade
						if (!wsMeta.use_relay && !wsMeta.client_port) {
							wsMeta.client_port = punch_port;
						}
						const server_open: WsEventData = {
							request_id: request_id,
							flavour: 'server-open',
							wx: {
								app_port: wsMeta.app_port,
								remote_addr: wsMeta.client_addr,
								remote_port: wsMeta.client_port
							}
						};

							if (wsMeta.use_relay){
							// we want the client to talk to us
								server_open.wx.remote_addr = (net.isIPv4(wsMeta.server_addr)?'4.':"6.")+"waluigi-servebeer.com";
							server_open.wx.remote_port = net.isIPv4(wsMeta.server_addr) ? rsPort.v4 : rsPort.v6;
						}

						// now we need to tell the server to open a udp socket
							wsServer.send(JSON.stringify(server_open ));					
						} else if (flavour === 'server-open'){
						// server is telling us her punch_port

						// we may already know the server's UDP port
							if (!wsMeta.use_relay && !wsMeta.server_port){
							wsMeta.server_port = punch_port;
						}
						const peer_punch_port: WsEventData = {
							request_id: request_id,
							flavour: 'peer-punch-port',
							wx: {
								app_port: wsMeta.app_port,
								remote_addr: wsMeta.server_addr,
								remote_port: wsMeta.server_port
							}
						};

						if (wsMeta.use_relay) {
							// need to tell the client to go somewhere else
							peer_punch_port.wx.remote_addr = (net.isIPv4(wsMeta.server_addr) ? '4.' : "6.") + "waluigi-servebeer.com";
							peer_punch_port.wx.remote_port = net.isIPv4(wsMeta.server_addr) ? rsPort.v4 : rsPort.v6;
							// also, we need to actually use the relay
							theWsbcUdpRelay(wsMeta);
						}

						// and now we tell the client about the server's punch port
							wsClient.send(JSON.stringify(peer_punch_port) );
					} else if (flavour === 'peer-punch-port') {
						// this shouldn't happen
					} else {
						// this also shouldn't happen
					}
				} else {
					// wsPair is undefined
					console.error('Received join handshake with invalid request_id:', parsedMessage);
				}
			} else if (parsedMessage instanceof Array
				&& typeof parsedMessage.forEach === 'function') {
				// client is listing services
					const services : Punch[] = parsedMessage;

				let clientData = clientMap.get(wsConn);
				if (typeof clientData !== 'undefined') {
					let username: string | undefined;
					let userId: number | undefined;
					let pkeyInfo: PkeyInfo | undefined;
					let sid: string | undefined;
					let validAuthn = false;

					// check user's info
					if (typeof clientData.pkeyInfo === 'object') {
						// client is using product key
						pkeyInfo = clientData.pkeyInfo;
						username = pkeyInfo.username;
						userId = pkeyInfo.userId;
						validAuthn = true;
					} else if (typeof clientData.sid === 'string') {
						// client logged in with cookie session data
						sid = clientData.sid;
							const session : SessionData | undefined = await redisStore.get(sid);
						username = session?.username ?? '';
						userId = session?.userId ?? 0;
						validAuthn = true;
					} else {
						// clientData doesn't have pkeyInfo or sid
						console.error('Client data has no authentication info:', clientData);
					}

					if (validAuthn && typeof username === 'string' && typeof userId === 'number') {
						// set the services
						services.forEach(punch => {
							punch.addr = addr;
							punch.username = username;
							punch.serviceName = punch.port ? punch.serviceName : '';
							punch.sku = generatePunchSku(punch);
						});
						// set the actual clientData
							const clientData_II: ClientData = {services, addr, userId, username};
						if (typeof pkeyInfo !== 'undefined') {
							clientData_II.pkeyInfo = pkeyInfo;
						} else if (typeof sid === 'string') {
							clientData_II.sid = sid;
						}
						clientData_II.barcode = generateClientBarcode(clientData_II);
						clientMap.set(wsConn, clientData_II);
					} else {
						// authentication info was invalid
					}
				} else {
					// clientData is undefined
					console.error('Received services list from unauthenticated client:', parsedMessage);
				}
			} else if (typeof parsedMessage['flavour'] === 'string'
			&& parsedMessage['flavour'] === 'wanna-join'
			&& typeof parsedMessage['sku'] === 'string') {
				// the WS client wants to join someone

				const sku = parsedMessage['sku'];
				let useRelay = false;
				if (typeof parsedMessage['useRelay'] === 'boolean') {
					useRelay = parsedMessage['useRelay'];
				}
				const wsServer = getWsClientByPunchSku(sku);
				const clientData = clientMap.get(wsConn);
				const reqPunch = getPunchBySku(sku);

				if (typeof clientData !== 'undefined'
				&& typeof wsServer !== 'undefined'
				&& typeof reqPunch !== 'undefined') {
					// and knowing is half the battle

					const reqAddr = clientData.addr;
					const reqUsername = clientData.username;
					const wsClient = wsConn;
					const res = undefined;

					await performJunction({wsClient,wsServer,reqPunch,reqUsername,reqAddr,useRelay,res});
				} else {
					// we are missing some important details
					console.error('Received wanna-join message with missing details:', parsedMessage);
				}
			} else {
				// we have received junk mail
				console.error('Received junk mail from client:', parsedMessage);
			}
		} else {
			// it's just a ping message
		}
		}catch(err){
		console.error(err);
	}
}

function ws_onceclose (this: ws.WebSocket,code : number, reason : Buffer) {
	const wsConn = this;
	peerAddrMap.delete(wsConn);
	wsConn.off('message', ws_onmessage);
	clientMap.delete(wsConn);
}

function wss_onwsClientError (err : Error, socket: Stream.Duplex, request: http.IncomingMessage){
	console.error('WebSocket client error', err);
	console.error(socket);
	console.error(request);
}

// exports? yes.
export {
	initWSS,
	joinMap as punchJoinMap,
	wss,
	clientMap,
	peerAddrMap
};

