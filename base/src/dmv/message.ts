import {Router, Request, Response} from 'express';
import {GIVE_UP, pidgen, queryDatabase} from "./annapolis";
import oracledb from "oracledb";
import {miracast} from "./anacostia";
import {MessageCreate} from "../goobo/common-core";

const router = Router({mergeParams: true});

async function createMessage(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const channel_id = req?.body?.channel_id;
		const message_content = req?.body?.message_content;
		if (typeof user_id === 'number' && typeof channel_id === 'number' && typeof message_content === 'string' && message_content) {
			// check something with permissions
			const parmesan = `
				SELECT c.guild_id 
				FROM channels c
				JOIN guild_members gm ON c.guild_id = gm.guild_id
				WHERE c.id = :c AND gm.user_id = :u`;
			const parm_params = {c: channel_id, u: user_id};
			const parmesan_result = await queryDatabase(parmesan, parm_params, false);
			if (parmesan_result && Array.isArray(parmesan_result.rows) && parmesan_result.rows.length === 1
				&& Array.isArray(parmesan_result.rows[0]) && parmesan_result.rows[0].length === 1
				&& typeof parmesan_result.rows[0][0] === 'number') {
				const guild_id = Number(parmesan_result.rows[0][0]);

				//create the message
				const message_id = pidgen.nextId();
				const sql = `insert into messages (id, content, channel_id, user_id) values (:message_id, :message_content, :channel_id, :user_id)`;
				const params = {message_id, message_content, channel_id, user_id};
				const result = await queryDatabase(sql, params, true);
				if (result && result.rowsAffected === 1) {
					res.status(200).json({message_id});
					const item_mc: MessageCreate = {
						flavour: 'gmail',
						grade:'M_CREATE',
						channel_id,
						message_row:[message_id, user_id, message_content]
					};
					miracast(guild_id, item_mc);
				} else {
					GIVE_UP(res, 'YOUR MESSAGE WAS NOT SAVED');
				}
			} else {
				GIVE_UP(res, 'you do not have permission to post in this channel');
			}
		} else {
			// don't have a user_id, channel_id, or message_content
			GIVE_UP(res, 'missing user_id, channel_id, or message_content');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt write the message down :-(');
	}
}
async function listMessages(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const channel_id = Number(req?.params?.channel_id);
		const before = Number(req?.query?.before);
		if (typeof user_id === 'number' && Number.isSafeInteger(channel_id)) {
			let sql = `
				select id, user_id, content 
				from messages 
				where channel_id = :channel_id
			`;
			const params: Record<string, number> = {channel_id};

			// if there's a 'before', use it!
			if (Number.isSafeInteger(before)) {
				sql += ' and id < :before';
				params['before'] = before;
			}

			// sort the messages
			sql += ' order by id desc fetch first 50 rows only';
			const messages = await queryDatabase(sql, params, false, {
				fetchInfo: {
					"CONTENT": {type: oracledb.STRING}
				}
			});
			if (messages && Array.isArray(messages.rows)) {
				// console.log(messages);
				res.status(200).json(messages.rows);			
			} else {
				GIVE_UP(res, 'messages isnt an array');
			}
		} else {
			// don't have a user_id or channel_id
			GIVE_UP(res, 'missing user_id or channel_id');
		}
	} catch (err) {
		console.error(err);
		GIVE_UP(res, 'couldnt list messages');
	}
}

async function updateMessage(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const message_id = Number(req?.params?.message_id);
		const message_content = req?.body?.message_content;
		if (typeof user_id === 'number' && Number.isSafeInteger(message_id) && typeof message_content === 'string' && message_content) {
			const sql = `update messages set content = :message_content where id = :message_id and user_id = :user_id`;
			const params = {message_content, message_id, user_id};
			await queryDatabase(sql, params, true);
			res.status(200).json({message_id});
		} else {
			GIVE_UP(res, 'missing user_id, message_id, or message_content');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt update message');
	}
}

async function deleteMessage(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const message_id = Number(req?.params?.message_id);
		if (typeof user_id === 'number' && Number.isSafeInteger(message_id)) {
			const sql = `delete from messages where id = :message_id and user_id = :user_id`;
			const params = {message_id, user_id};
			await queryDatabase(sql, params, true);
			res.status(200).json({message_id});
		} else {
			GIVE_UP(res, 'missing user_id or message_id');
		}
	} catch (err) {
		GIVE_UP(res, 'couldnt delete message');
	}
}

router.post('/create', createMessage);
router.get('/list/:channel_id', listMessages);
router.put('/update/:message_id', updateMessage);
router.delete('/delete/:message_id', deleteMessage);

export default router;
