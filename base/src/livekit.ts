import {Request, Response} from 'express';
import {AccessToken} from 'livekit-server-sdk';
import path from 'node:path';
import express from 'express';

import {astext} from './util_dump';
import {express_app as app, isAuthenticated} from './express_app';
import {SessionData} from "express-session";

const LIVEKIT_API_KEY = astext("keys/LIVEKIT_API_KEY");
const LIVEKIT_API_SECRET = astext("keys/LIVEKIT_API_SECRET");

async function lkJoinVoice(req: Request, res: Response) {
	try {
		let username = req.session.username;
		let roomcode: string | undefined = req?.body?.roomcode ?? 'general-chat';
		if (typeof username === 'string' && typeof roomcode === 'string') {
			// those names are real

			const access_token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
				identity: username,
				name: username
			});

			access_token.addGrant({
				roomJoin: true,
				room: roomcode,
				canPublish: true,
				canSubscribe: true
			});

			const token = access_token.toJwt();
			res.json({token});

		} else {
			// missing some important deets
			res.status(400).json({msg: 'Missing username or roomcode'});
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({msg: 'Failed to join voice channel'});
	}
}

app.post('/api/join-voice', isAuthenticated, lkJoinVoice);
app.use("/livekit", express.static(path.join(__dirname, "..", 'livekit')));

export function please_livekit() {

}
