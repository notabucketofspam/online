import {Router, Request, Response} from 'express';
import {GIVE_UP, pidgen, queryDatabase} from "./annapolis";

const router = Router({ mergeParams: true });

const CHANNEL_TYPES = new Set(['text', 'voice']);

async function createChannel(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const guild_id = req?.body?.guild_id;
		const channel_name = req?.body?.channel_name;
		const channel_type = req?.body?.channel_type || 'text';
		if (typeof user_id === 'number'
			&& typeof guild_id === 'number'
			&& typeof channel_name === 'string' && channel_name
			&& typeof channel_type === 'string' && channel_type && CHANNEL_TYPES.has(channel_type)) {
			//auth check for owner_id
			const auth_sql = `select owner_id from guilds where id = :guild_id and owner_id = :user_id`;
			const auth_params = { guild_id, user_id };
			const auth_result = await queryDatabase(auth_sql, auth_params, false);
			if (auth_result && Array.isArray(auth_result.rows) && auth_result.rows.length) {
				// auth is ok
				// create the channel
				const channel_id = pidgen.nextId();
				const sql = `
				insert into channels (id, name, guild_id, channel_type)
					values (:channel_id, :channel_name, :guild_id, :channel_type)`;
				const params = { channel_id, channel_name, guild_id, channel_type };
				await queryDatabase(sql, params, true);

				res.status(200).json({ channel_id });
			} else {
				// no auth
				GIVE_UP(res, 'user is not the owner of the guild');
			}
		} else {
			// don't have a user_id, guild_id, channel_name, or channel_type is invalid
			GIVE_UP(res, 'missing user_id, guild_id, channel_name, OR channel_type is invalid');
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
				select id, name, channel_type
				from channels 
				where guild_id = :guild_id
			`;
			const params = {guild_id};
			const result = await queryDatabase(sql, params);
			if (result && Array.isArray(result.rows)) {
				res.status(200).json({channels: result.rows});
			} else {
				GIVE_UP(res, 'channels isnt an array');
			}
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

async function listAllChannelsForUser(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		if (user_id) {
			// thanks gemini
			const sql = `
				SELECT
					g.owner_id AS owner_id,
					g.id AS guild_id,
					g.name AS guild_name,
					COALESCE(
						JSON_ARRAYAGG(
							JSON_OBJECT(
								'id' VALUE c.id,
								'name' VALUE c.name,
								'channel_type' VALUE c.channel_type
							)
						), 
						'[]'
					) AS channels
				FROM guilds g
				JOIN guild_members gm ON g.id = gm.guild_id
				LEFT JOIN channels c ON g.id = c.guild_id
				WHERE gm.user_id = :user_id
				GROUP BY g.id, g.name, g.owner_id;
			`;
			const params = {user_id};
			const result = await queryDatabase(sql, params);
			if (result && Array.isArray(result.rows)) {
				const rows = result.rows as Array<[number, number, string, any]>;
				const guilds = rows.map(([owner_id, guild_id, guild_name, channels]) => ({
					owner_id,
					id: guild_id,
					name: guild_name,
					channels: JSON.parse(channels||'[]')
				}));
				res.status(200).json({guilds});
			} else {
				GIVE_UP(res, 'guilds isnt an array');
			}
		} else {
			GIVE_UP(res, 'missing user_id');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt list all channels for user');
	}
}

router.post('/create', createChannel);
router.get('/list/:guild_id', listChannels);
router.put('/update/:channel_id', updateChannel);
router.delete('/delete/:channel_id', deleteChannel);
router.get('/list-all', listAllChannelsForUser);

export default router;
