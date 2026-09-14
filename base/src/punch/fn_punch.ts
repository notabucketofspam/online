// all sorts of imports
import crypto from "node:crypto";
import net from "node:net";

import { Response } from 'express';
import ws from 'ws';

import * as odb from "../db";
import { generate_reset_token } from "../express_app";
import { wss, clientMap, punchJoinMap as joinMap } from "./punch";

import { Punch, ClientData, WsEventData, WsPairMeta } from "VocabQuiz";
import { SessionData } from "express-session";

// ==============================================================
// some helper functions for enumerating Punch services

function getPunchServices(): Punch[] {
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
	} catch (err) {
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
	} catch (err) {
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
	return crypto.hash('sha256', punch.addr + punch.port + punch.serviceName + punch.username);
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

	return crypto.hash('sha256', specialSpice + userId);
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
async function performJunction({ wsClient, wsServer, reqPunch, reqUsername, reqAddr, useRelay, res }: JunctionOptions) {
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
						res.status(500).json({ msg: "Target user doesn't trust you yet." });
					}
				}
			} else {
				// result was null
				if (res) {
					res.status(500).json({ msg: "database error" });
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
			joinMap.set(request_id, { wsClient, wsServer, wsMeta });
			if (useRelay) {
				// he wants to use the relay
				client_open.wx.remote_addr = (net.isIPv4(wsMeta.server_addr) ? '4.' : "6.") + "waluigi-servebeer.com";
			}
			wsClient.send(JSON.stringify(client_open));
			if (res) {
				res.status(200).json({ msg: 'ok' });
			}
			// eventually delete the temp data in joinMap
			setTimeout(function () {
				joinMap.delete(request_id);
			}, 10000);
			algood = true;
		}

	} catch (err) {
		console.error(err);
		if (res) {
			res.status(500).json({ msg: "error with join" });
		}
	}
	return algood;
}

export {
	getPunchServices,
	getClientByService,
	getWsClientByPunchSku,
	getPunchBySku,
	generatePunchSku,
	generateClientBarcode,
	performJunction
}; 
