import {Request, Response} from 'express';
import {AccessToken, RoomServiceClient} from 'livekit-server-sdk';
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

			const token = await access_token.toJwt();
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

const roomService = new RoomServiceClient(
	'http://localhost:7880',
	LIVEKIT_API_KEY,
	LIVEKIT_API_SECRET
);

async function getActiveRooms(req: Request, res: Response) {
	try {
		// Ask LiveKit for every room that currently exists
		const rooms = await roomService.listRooms();

		// Clean up the data object before sending it to the browser
		const publicRooms = rooms.map(room => ({
			name: room.name,
			sid: room.sid,
			participantCount: room.numParticipants,
			creationTime: Number(room.creationTime)
		}));

		res.json(publicRooms);
	} catch (error) {
		console.error(error);
		res.status(500).json({error: 'Failed to fetch rooms from LiveKit'});
	}
}

app.post('/api/join-voice', isAuthenticated, lkJoinVoice);
app.get('/api/active-rooms', getActiveRooms);
app.use("/livekit", express.static(path.join(__dirname, "..", 'livekit')));

