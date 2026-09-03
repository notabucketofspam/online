import {Router, Request, Response} from 'express';
import {GIVE_UP, pidgen, queryDatabase} from "./annapolis";

const router = Router({mergeParams: true});

async function createChannel(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const guild_id = req?.body?.guild_id;
		const channel_name = req?.body?.channel_name;
		if (typeof user_id === 'number' && typeof guild_id === 'number' && typeof channel_name === 'string' && channel_name) {
			// create the channel
			const channel_id = pidgen.nextId();
			const sql = `insert into channels (id, name, guild_id) values (:channel_id, :channel_name, :guild_id)`;
			const params = {channel_id, channel_name, guild_id};
			await queryDatabase(sql, params, true);

			res.status(200).json({channel_id});
		} else {
			// don't have a user_id, guild_id, or channel_name
			GIVE_UP(res, 'missing user_id, guild_id, or channel_name');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt make the channel');
	}
}
async function listChannels(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const guild_id = Number(req?.params?.guild_id);
		if (typeof user_id === 'number' && Number.isSafeInteger(guild_id)) {
			const sql = `
				select id, name, type
				from channels 
				where guild_id = :guild_id
			`;
			const params = {guild_id};
			const channels = await queryDatabase(sql, params);
			res.status(200).json({channels});
		} else {
			// don't have a user_id or guild_id
			GIVE_UP(res, 'missing user_id or guild_id');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt list channels');
	}
}

async function updateChannel(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const channel_id = Number(req?.params?.channel_id);
		const channel_name = req?.body?.channel_name;
		if (typeof user_id === 'number' && Number.isSafeInteger(channel_id) && typeof channel_name === 'string' && channel_name) {
			const sql = `update channels set name = :channel_name where id = :channel_id and user_id = :user_id`;
			const params = {channel_name, channel_id, user_id};
			await queryDatabase(sql, params, true);
			res.status(200).json({channel_id});
		} else {
			GIVE_UP(res, 'missing user_id, channel_id, or channel_name');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt update channel');
	}
}

async function deleteChannel(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const channel_id = Number(req?.params?.channel_id);
		if (typeof user_id === 'number' && Number.isSafeInteger(channel_id)) {
			const sql = `delete from channels where id = :channel_id and user_id = :user_id`;
			const params = {channel_id, user_id};
			await queryDatabase(sql, params, true);
			res.status(200).json({channel_id});
		} else {
			GIVE_UP(res, 'missing user_id or channel_id');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt delete channel');
	}
}

router.post('/create', createChannel);
router.get('/list/:guild_id', listChannels);
router.put('/update/:channel_id', updateChannel);
router.delete('/delete/:channel_id', deleteChannel);

export default router;
