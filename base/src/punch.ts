// all sorts of imports
import * as fs from 'node:fs';
import * as path from "node:path";
import { Request, Response } from 'express';

import * as odb from "./db";
import {generate_reset_token, isAuthenticated, express_app as app, redisStore } from "./express_app";
import {Punch, ClientData, WsbcReply, WsEventData, WsPair, WsPairMeta } from "VocabQuiz";

declare module 'express-session' {
	interface SessionData {
		userId: number;
		username: string;
		email: string;
		storage: object;
		id: string;
	}
}
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

const allowJoinUnsafeAddr = fs.existsSync('keys/allow-unsafe-addr.txt');

/**temporarily remember the WebSockets involved in the punch port peer pairing process*/
const joinMap: Map<string, WsPair> = new Map();
export {joinMap as punchJoinMap};

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

			const reqPunch: Punch = (contentType === 'text/plain') ? JSON.parse(req.body) : req.body;
			let unsafeAddr: string | undefined;
			if (allowJoinUnsafeAddr && typeof reqPunch.unsafeAddr === 'string') {
				unsafeAddr = reqPunch.unsafeAddr;
			}
			
			// search for client with matching username and IP
			const search: Punch = {
				addr: reqAddr,
				port: 0,
				serviceName: '',
				username: reqUsername
			};
			const wsClient = getClientByService(search);

			// get the server who is hosting this service
			const wsServer = getClientByService(reqPunch);

			if (typeof wsClient !== 'undefined' && typeof wsServer !== 'undefined' ) {
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
						app_port: reqPunch.port
					};
					joinMap.set(request_id, {wsClient, wsServer, wsMeta});
					wsClient.send(JSON.stringify(client_open));
					res.status(200).json({msg:'ok'});
					// eventually delete the temp data in joinMap
					setTimeout(function(){
						joinMap.delete(request_id);
					}, 10000);
				}
			} else {
				// couldn't find a websocket client advertising this service
				res.status(500).json({msg:"Unable to find opponent"});
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

let wss: ws.WebSocketServer;

const clientMap: WeakMap<ws, ClientData> = new WeakMap();

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

function wss_onconnection (ws : ws.WebSocket, req : Request) {
	const xff = req.headersDistinct['x-forwarded-for']?.at(0);
	const addr = xff??'';
	
	async function ws_onmessage (message : ws.RawData, isBinary: boolean){
		try {
			if (!isBinary) {
				const rawMessage = message.toString();
				const parsedMessage = JSON.parse(rawMessage);

				if (typeof parsedMessage['Cookie'] === 'string') {
					// client wants to set the session id
					let sid: string = parsedMessage['Cookie'];
					if (sid.includes('connect.sid=')){
						sid = sid.replace('connect.sid=','');
					}
					sid = decodeURIComponent(sid);
					const rx = /s:(.*?)\./;
					sid = rx.exec(sid)?.[1] ?? sid;
					const services: Punch[] = [];
					clientMap.set(ws, {sid, services, addr});

				} else if (typeof parsedMessage['request_id'] === 'string'
				&& typeof parsedMessage['flavour'] === 'string'
				&& typeof parsedMessage['punch_port'] === 'number' ) {
					// client is doing the join handshake thing
					const ev_data: WsbcReply = parsedMessage;
					const {request_id, flavour, punch_port} = ev_data;
				
					const wsPair = joinMap.get(request_id);
					if (typeof wsPair !== 'undefined') {
						const {wsClient, wsServer, wsMeta} = wsPair;
						if (flavour === 'client-open') {
							// client has opened the udp socket

							// we may already have the client's UDP port, thanks to grandFacade						
							if (!wsMeta.client_port) {
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

							// now we need to tell the server to open a udp socket
							wsServer.send(JSON.stringify(server_open ));					
						} else if (flavour === 'server-open'){
							// server is telling us her punch_port

							// we may already know the server's UDP port
							if (!wsMeta.server_port){
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

							// and now we tell the client about the server's punch port
							wsClient.send(JSON.stringify(peer_punch_port) );
						} else if (flavour === 'peer-punch-port') {
							// this shouldn't happen
						} else {
							// this also shouldn't happen
						}
					} else {
						// wsPair is undefined
					}
				} else {
					// client is listing services
					let clientData = clientMap.get(ws);
					if (typeof clientData !== 'undefined'){
						// check session info
						const sid = clientData.sid;
						const session: SessionData | undefined = await redisStore.get(sid);
						let username = session?.username ?? '';
						const services: Punch[] = parsedMessage;
						if (typeof services.forEach === 'function') {
							services.forEach(punch => {
								punch.addr = addr;
								punch.username = username;
							});
						}
						clientMap.set(ws, {sid, services, addr});
					} else {
						// clientData is undefined
					}
				}
			} else {
				// it's just a ping message
			}
		}catch(err){
			console.error(err);
		}
	}
	ws.on('message', ws_onmessage);

	function ws_onceclose (code : number, reason : Buffer) {
		ws.off('message', ws_onmessage);
		clientMap.delete(ws);
	}
	ws.once('close', ws_onceclose);
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

function getClientByService(search: Punch): ws | undefined {
	let foundClient: ws | undefined;
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

// exports? yes.
export {initWSS};
