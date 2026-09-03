import {Router, Request, Response} from 'express';
import {GIVE_UP, pidgen, queryDatabase} from "./annapolis";

const router = Router({mergeParams: true});

async function createMessage(req: Request, res: Response) {
	try {
		const user_id = req.session.userId;
		const channel_id = req?.body?.channel_id;
		const message_content = req?.body?.message_content;
		if (typeof user_id === 'number' && typeof channel_id === 'number' && typeof message_content === 'string' && message_content) {
			//create the message
			const message_id = pidgen.nextId();
			const sql = `insert into messages (id, content, channel_id, user_id) values (:message_id, :message_content, :channel_id, :user_id)`;
			const params = {message_id, message_content, channel_id, user_id};
			await queryDatabase(sql, params, true);
			res.status(200).json({message_id});
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
			const messages = await queryDatabase(sql, params);
			res.status(200).json({messages});
		} else {
			// don't have a user_id or channel_id
			GIVE_UP(res, 'missing user_id or channel_id');
		}
	} catch (err) {
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
