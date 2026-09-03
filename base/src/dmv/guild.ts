import {Router, Request, Response} from 'express';
import {GIVE_UP, pidgen, queryDatabase} from "./annapolis";

const router = Router({mergeParams: true});

async function createGuild(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const guild_name = req?.body?.guild_name;
		if (typeof user_id === 'number' && typeof guild_name === 'string' && guild_name) {
			//create the guild
			const guild_id = pidgen.nextId();
			const sql = `insert into guilds (id, name, owner_id) values (:guild_id, :guild_name, :user_id)`;
			const params = {guild_id, guild_name, user_id};
			await queryDatabase(sql, params);

			// put the user into the guild as a member
			const member_sql = `insert into guild_members (guild_id, user_id) values (:guild_id, :user_id)`;
			const member_params = {guild_id, user_id};
			await queryDatabase(member_sql, member_params, true);

			res.status(200).json({guild_id});
		} else {
			// don't have a user_id or guild_name
			GIVE_UP(res, 'missing user_id or guild_name');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt make the guild');
	}
}
async function listGuilds(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		if (typeof user_id === 'number') {
			// list all guilds that the user is a member of
			const sql = `
				select g.id, g.name 
				from guilds g
				join guild_members gm on g.id = gm.guild_id
				where gm.user_id = :user_id
			`;
			const params = {user_id};
			const guilds = await queryDatabase(sql, params);
			res.status(200).json({guilds});
		} else {
			// don't have a user id, so we can't list the guilds
			GIVE_UP(res, 'missing user_id');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt list the guilds');
	}
}
async function updateGuild(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const guild_id = Number(req?.params?.guild_id);
		const guild_name = req?.body?.guild_name;
		if (typeof user_id === 'number' && Number.isSafeInteger(guild_id) && typeof guild_name === 'string' && guild_name) {
			const sql = `update guilds set name = :guild_name where id = :guild_id and owner_id = :user_id`;
			const params = {guild_name, guild_id, user_id};
			await queryDatabase(sql, params, true);
			res.status(200).json({guild_id});
		} else {
			GIVE_UP(res, 'missing user_id, guild_id, or guild_name');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt update guild');
	}
}
async function deleteGuild(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const guild_id = Number(req?.params?.guild_id);
		if (typeof user_id === 'number' && Number.isSafeInteger(guild_id)) {
			const sql = `delete from guilds where id = :guild_id and owner_id = :user_id`;
			const params = {guild_id, user_id};
			await queryDatabase(sql, params, true);
			res.status(200).json({guild_id});
		} else {
			GIVE_UP(res, 'missing user_id or guild_id');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt delete guild');
	}
}

router.post('/create', createGuild);
router.get('/list', listGuilds);
router.put('/update/:guild_id', updateGuild);
router.delete('/delete/:guild_id', deleteGuild);

export default router;
