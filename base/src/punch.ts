// all sorts of imports
import * as path from "node:path";
import { Request, Response } from 'express';
import crypto from "node:crypto";

import * as odb from "./db";
import {generate_reset_token, isAuthenticated, express_app as app, redisStore } from "./express_app";
import {Punch, ClientData, WsbcReply, WsEventData, WsPair, WsPairMeta } from "VocabQuiz";

import {SessionData} from "express-session";

// ========================================================
// this is all the express-related punch stuff

function get_ip(req: Request, res: Response){
	try {
		const xff = req.header('X-Forwarded-For');
		res.setHeader('Content-Type', 'text/plain');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(200).send(xff);
	} catch (err) {
		res.status(500).send({ msg: "error sorry" });
	}
}

function getPunchHtml(req: Request, res: Response){
	res.sendFile(path.join(__dirname, "..", 'html','punch.html'));
}

/**What do you have for sale? */
async function getPunchList(req: Request, res: Response){
	try {
		let filteredView: Punch[] = [];
		let username = req.session.username;
		if (typeof username !== 'undefined'){
			const all_services = getPunchServices();

			if (all_services.length !== 0) {
				// we have some services

				filteredView = all_services.map(punch => {
					let {serviceName, username, sku, addr, port} = punch;
					sku ??= generatePunchSku(punch);
					addr = net.isIPv4(addr) ? '0.0.0.0' : "::";
					return {serviceName, username, sku, addr, port};
				});

				/*
				// result is a Map<username, names of other users that he trusts>
				const result = await odb.getTrusts();
				if (result !== null){
					// only display services for users whom trust this user
					filteredView = all_services.filter(punch=>
						result.get(punch.username)?.includes(username) || punch.username === username
					);
				} else {
					// result was null, so for now we'll just limit it to same-username punches
					filteredView = all_services.filter(punch=>punch.username === username);					
				}
				*/
			} else {
				// we've got no services
			}
		} else {
			// the username ain't real, so we ignore him
		}

		res.status(200).json(filteredView);
	} catch (err) {
		console.error(err);
		res.status(500).json({msg:"error sorry"});
	}
}

/**temporarily remember the WebSockets involved in the punch port peer pairing process*/
const joinMap: Map<string, WsPair> = new Map();
export {joinMap as punchJoinMap};

import {rsPort, theWsbcUdpRelay } from './udp';

/**
 * A user wants to connect to a particular Punch service
 */
async function askToJoin(req: Request, res: Response){
	try {
		const reqUsername = req.session.username;
		const reqAddr = req.header('X-Forwarded-For');
		const contentType = req.header('Content-Type');
		//console.log(reqAddr);
		//console.log('content type', contentType);
		//console.log(req.body);
		if (typeof reqUsername === 'undefined' || typeof reqAddr === 'undefined' || typeof req.body === 'undefined') {
			// it's junk
			res.status(500).json({msg:"error with request"});
		} else {
			// we got a live one

			const reqPunchIn: Punch = (contentType === 'text/plain') ? JSON.parse(req.body) : req.body;
			let useRelay = false;
			if (typeof reqPunchIn.useRelay === 'boolean') {
				useRelay = reqPunchIn.useRelay;
			}
			const reqPunch = getPunchBySku(reqPunchIn.sku);
			
			// search for client with matching username and IP
			const search: Punch = {
				addr: reqAddr,
				port: 0,
				serviceName: '',
				username: reqUsername,
				sku:""
			};
			const wsClient = getClientByService(search);

			// get the server who is hosting this service
			const wsServer = getWsClientByPunchSku(reqPunchIn.sku);

			if (typeof wsClient !== 'undefined' && typeof wsServer !== 'undefined' 
			&& typeof reqPunch !== 'undefined') {
				await performJunction({wsClient, wsServer, reqPunch, reqUsername, reqAddr, useRelay, res});

				/*
				const request_id = generate_reset_token();
				const client_open: WsEventData = {
					request_id: request_id ,
					flavour: 'client-open',
					wx: {
						app_port: reqPunch.port ,
						remote_addr: reqPunch.addr ,
						remote_port: 0
					}
				};

				let shouldSend = false;
				if (reqUsername === reqPunch.username){
					// same-user, so we don't have to check the database for trust issues
					shouldSend = true;
				} else {
					// check odb for trust
					const result = await odb.getTrusts();
					if (result !== null){
						const isTrusted = result.get(reqPunch.username)?.includes(reqUsername);
						if (isTrusted) {
							// our guy is trusted
							shouldSend = true;
						} else {
							// user isnt trusted
							res.status(500).json({msg:"Target user doesn't trust you yet."});
						}
					} else {
						// result was null
						res.status(500).json({msg:"database error"});
					}
				}

				if (shouldSend){
					const wsMeta: WsPairMeta = {
						client_addr: reqAddr,
						client_port: 0,
						server_addr: reqPunch.addr,
						server_port: 0,
						app_port: reqPunch.port,
						use_relay: useRelay
					};
					joinMap.set(request_id, {wsClient, wsServer, wsMeta});
					if (useRelay) {
						// he wants to use the relay
						client_open.wx.remote_addr = (net.isIPv4(wsMeta.server_addr) ? '4.' : "6.") + "waluigi-servebeer.com";
					}
					wsClient.send(JSON.stringify(client_open));
					res.status(200).json({msg:'ok'});
					// eventually delete the temp data in joinMap
					setTimeout(function(){
						joinMap.delete(request_id);
					}, 10000);
				}
				*/
			} else if (typeof wsClient !== 'undefined') {
				// couldn't find a websocket client advertising this service
				// specifically, wsClient was ok, but wsServer was bad
				res.status(500).json({msg:"Unable to find opponent"});
			} else if (typeof wsServer !== 'undefined'){
				// "from my point of view the clients are evil!"
				res.status(500).json({ msg: "Unable to find <i>you</i>, dear user.<br/>Make sure that OPM is running on your pc." });
			}
		}
	} catch(err){
		console.error(err);
		res.status(500).json({msg:"error with join"});
	}
}

app.get("/ip", get_ip);
app.get("/punch", getPunchHtml);
app.get("/api/punch/list", isAuthenticated, getPunchList);
app.post("/api/punch/join", isAuthenticated, askToJoin);

// ===========================================================
// websocket server
import ws from 'ws';
import Stream from 'node:stream';
import http from 'node:http';
import net from "node:net";
import {PkeyInfo, WannaJoin} from 'VocabQuiz';

let wss: ws.WebSocketServer;

const clientMap: WeakMap<ws.WebSocket, ClientData> = new WeakMap();
const peerAddrMap: WeakMap<ws.WebSocket, string> = new WeakMap();

// we need the server returned by app.listen()
function initWSS (server : ws.ServerOptions["server"]) {
	wss = new ws.WebSocketServer({
		server,
		host: 'localhost',
		clientTracking: true,
		autoPong: true,
		path: '/wss'
	});
	wss.on('wsClientError', wss_onwsClientError);
	//wss.once('listening', wss_oncelistening);
	wss.on('connection', wss_onconnection);
}

function wss_oncelistening(){
	console.log('WSS OK', wss.address());
}

const authn_ok: WsEventData = {
	flavour: "authn-ok",
	request_id: 'AUTHN_IS_OK',
	wx: {
		app_port: 0,
		remote_addr: 'waluigi-servebeer.com',
		remote_port: 0
	}
};

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

// ==============================================================
// some helper functions for enumerating Punch services

function getPunchServices(): Punch[]{
	const all_services: Punch[] = [];
	try {
		// Set.prototype.map wasn't working for some reason
		wss.clients.forEach(ws => {
			let clientData = clientMap.get(ws);
			if (typeof clientData !== 'undefined') {
				// remove services where port === 0
				let services_perchance = clientData.services.filter(punch => punch.port);
				all_services.push(...services_perchance);
			}
		});
	} catch(err) {
		console.error(err);
	}
	return all_services;
}

function getClientByService(search: Punch): ws.WebSocket | undefined {
	let foundClient: ws.WebSocket | undefined;
	try {
		searching: for (const client of wss.clients) {
			let clientData = clientMap.get(client);
			if (typeof clientData !== 'undefined') {
				for (const service of clientData.services) {
					if (service.addr === search.addr &&
						service.port === search.port &&
						service.serviceName === search.serviceName &&
						service.username === search.username) {
						foundClient = client;
						break searching;
					}
				}
			}
		}
	} catch(err) {
		console.error(err);
	}
	return foundClient;
}

function getWsClientByPunchSku(searchSku: string): ws.WebSocket | undefined {
	let foundClient: ws.WebSocket | undefined;
	try {
		searching: for (const client of wss.clients) {
			let clientData = clientMap.get(client);
			if (typeof clientData !== 'undefined') {
				for (const service of clientData.services) {
					if (service.sku === searchSku) {
						foundClient = client;
						break searching;
					}
				}
			}
		}
	} catch (err) {
		console.error(err);
	}
	return foundClient;
}

function getPunchBySku(searchSku: string): Punch | undefined {
	let foundPunch: Punch | undefined;
	try {
		searching: for (const client of wss.clients) {
			let clientData = clientMap.get(client);
			if (typeof clientData !== 'undefined') {
				for (const service of clientData.services) {
					if (service.sku === searchSku) {
						foundPunch = service;
						break searching;
					}
				}
			}
		}
	} catch (err) {
		console.error(err);
	}
	return foundPunch;
}

function generatePunchSku(punch: Punch) {
	return crypto.hash('sha256', punch.addr+punch.port+punch.serviceName+punch.username);
}

function generateClientBarcode(clientData: ClientData): string {
	let specialSpice = '';
	if (typeof clientData.sid === 'string') {
		specialSpice = clientData.sid;
	} else if (typeof clientData.pkeyInfo === 'object' && typeof clientData.pkeyInfo.pkey === 'string') {
		specialSpice = clientData.pkeyInfo.pkey;
	} else {
		// worst-case scenario is that we address him by his address instead of his name
		specialSpice = clientData.addr;
	}
	const userId = clientData.userId;

	return crypto.hash('sha256',specialSpice+userId);
}

interface JunctionOptions {
	wsClient: ws.WebSocket;
	wsServer: ws.WebSocket;
	reqPunch: Punch;
	reqUsername: string;
	reqAddr: string;
	useRelay: boolean;
	res: Response | undefined;
}
async function performJunction({wsClient, wsServer, reqPunch, reqUsername, reqAddr, useRelay, res}: JunctionOptions) {
	let algood = false;
	try {
		const request_id = generate_reset_token();
		const client_open: WsEventData = {
			request_id: request_id,
			flavour: 'client-open',
			wx: {
				app_port: reqPunch.port,
				remote_addr: reqPunch.addr,
				remote_port: 0
			}
		};

		let shouldSend = false;
		if (reqUsername === reqPunch.username) {
			// same-user, so we don't have to check the database for trust issues
			shouldSend = true;
		} else {
			// check odb for trust
			const result = await odb.getTrusts();
			if (result !== null) {
				const isTrusted = result.get(reqPunch.username)?.includes(reqUsername);
				if (isTrusted) {
					// our guy is trusted
					shouldSend = true;
				} else {
					// user isnt trusted
					if (res) {
						res.status(500).json({msg: "Target user doesn't trust you yet."});
					}
				}
			} else {
				// result was null
				if (res) {
					res.status(500).json({msg: "database error"});
				}
			}
		}

		if (shouldSend) {
			const wsMeta: WsPairMeta = {
				client_addr: reqAddr,
				client_port: 0,
				server_addr: reqPunch.addr,
				server_port: 0,
				app_port: reqPunch.port,
				use_relay: useRelay
			};
			joinMap.set(request_id, {wsClient, wsServer, wsMeta});
			if (useRelay) {
				// he wants to use the relay
				client_open.wx.remote_addr = (net.isIPv4(wsMeta.server_addr) ? '4.' : "6.") + "waluigi-servebeer.com";
			}
			wsClient.send(JSON.stringify(client_open));
			if (res){
				res.status(200).json({msg: 'ok'});
			}
			// eventually delete the temp data in joinMap
			setTimeout(function() {
				joinMap.delete(request_id);
			}, 10000);
			algood = true;
		}

	} catch (err) {
		console.error(err);
		if (res) {
			res.status(500).json({msg: "error with join"});
		}
	}
	return algood;
}

// exports? yes.
export {initWSS};
