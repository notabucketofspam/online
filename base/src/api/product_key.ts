import { Request, Response, Router } from 'express';
import { generate_reset_token, isAuthenticated } from "../express_app";
import { generateMSProductKey } from "../util_dump";
import * as odb from "../db";
const router = Router();

async function createKey(req: Request, res: Response) {
	try {
		const reqbody = req.body;
		let keyname = reqbody.keyname;
		if (!keyname || typeof keyname !== 'string') {
			keyname = generate_reset_token();
		}
		const newkey = generateMSProductKey();
		const userId = req.session.userId;
		if (typeof userId === 'number') {
			const result = await odb.updatePkeys(userId, { [newkey]: keyname });
			if (!result) {
				res.status(500).json({ error: 'Failed to update product keys in the database' });
				return;
			}
		}
		res.status(200).json({ name: keyname, key: newkey });
	} catch (err) {
		res.status(500).json({ error: 'Internal server error' });
	}
}

async function listKeys(req: Request, res: Response) {
	try {
		const userId = req.session.userId;
		if (typeof userId === 'number') {
			const pkeys = await odb.getPkeys(userId);
			if (pkeys !== null) {
				res.status(200).json({ pkeys });
			} else {
				res.status(500).json({ error: 'Failed to retrieve product keys from the database' });
			}
		} else {
			res.status(401).json({ error: 'worthless' });
			return;
		}
	} catch (err) {
		res.status(500).json({ error: 'Internal server error' });
	}
}

async function deleteKey(req: Request, res: Response) {
	try {
		const reqbody = req.body;
		const keyToDelete = reqbody.key;
		if (!keyToDelete || typeof keyToDelete !== 'string') {
			res.status(400).json({ error: 'Invalid request body' });
			return;
		}
		const userId = req.session.userId;
		if (typeof userId === 'number') {
			const result = await odb.removeFromPkeys(userId, keyToDelete);
			if (result) {
				res.status(200).json({ message: 'Key deleted successfully' });
			} else {
				// no result
				res.status(500).json({ error: 'Failed to delete the product key from the database' });
			}
		} else {
			// no user id
			res.status(401).json({ error: 'wretched' });
		}
	} catch (err) {
		res.status(500).json({ error: 'Internal server error' });
	}
}

router.post('/create', isAuthenticated, createKey);
router.get('/list', isAuthenticated, listKeys);
router.post('/delete', isAuthenticated, deleteKey);

export { router as rt_pkey };
