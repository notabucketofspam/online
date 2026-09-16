// all sorts of imports
import net from "node:net";

import { Request, Response, Router } from 'express';

import {
	getPunchBySku,
	getWsClientByPunchSku,
	performJunction,
	generatePunchSku,
	getClientByService,
	getPunchServices
} from "./fn_punch"; 

import { Punch } from "VocabQuiz";
import { SessionData } from "express-session";

// ========================================================
// this is all the express-related punch stuff

const router = Router();

/**What do you have for sale? */
async function getPunchList(req: Request, res: Response) {
	try {
		let filteredView: Punch[] = [];
		let username = req.session.username;
		if (typeof username !== 'undefined') {
			const all_services = getPunchServices();

			if (all_services.length !== 0) {
				// we have some services

				filteredView = all_services.map(punch => {
					let { serviceName, username, sku, addr, port } = punch;
					sku ??= generatePunchSku(punch);
					addr = net.isIPv4(addr) ? '0.0.0.0' : "::";
					port = -1;
					return { serviceName, username, sku, addr, port };
				});
			} else {
				// we've got no services
			}
		} else {
			// the username ain't real, so we ignore him
		}

		res.status(200).json(filteredView);
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: "error sorry" });
	}
}

/**
 * A user wants to connect to a particular Punch service
 */
async function askToJoin(req: Request, res: Response) {
	try {
		const reqUsername = req.session.username;
		const reqAddr = req.header('X-Forwarded-For');
		const contentType = req.header('Content-Type');
		//console.log(reqAddr);
		//console.log('content type', contentType);
		//console.log(req.body);
		if (typeof reqUsername === 'undefined' || typeof reqAddr === 'undefined' || typeof req.body === 'undefined') {
			// it's junk
			res.status(500).json({ msg: "error with request" });
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
				sku: ""
			};
			const wsClient = getClientByService(search);

			// get the server who is hosting this service
			const wsServer = getWsClientByPunchSku(reqPunchIn.sku);

			if (typeof wsClient !== 'undefined' && typeof wsServer !== 'undefined'
				&& typeof reqPunch !== 'undefined') {
				await performJunction({ wsClient, wsServer, reqPunch, reqUsername, reqAddr, useRelay, res });

			} else if (typeof wsClient !== 'undefined') {
				// couldn't find a websocket client advertising this service
				// specifically, wsClient was ok, but wsServer was bad
				res.status(500).json({ msg: "Unable to find opponent" });
			} else if (typeof wsServer !== 'undefined') {
				// "from my point of view the clients are evil!"
				res.status(500).json({ msg: "Unable to find <i>you</i>, dear user.<br/>Make sure that OPM is running on your pc." });
			}
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: "error with join" });
	}
}

router.get("/list", getPunchList);
router.post("/join", askToJoin);
export { router as rt_punch };

