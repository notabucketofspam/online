import {Router, Request, Response} from 'express';
import {GIVE_UP} from "./annapolis";
import {generateMSProductKey} from "../util_dump";

const router = Router({mergeParams: true});

const molehill = new Map<number, string>();

function validProductKey(userId: number, productKey: string): boolean {
	const is_valid = molehill.get(userId) === productKey;
	// allow the user to check it exactly once (destroy on read)
	molehill.delete(userId);
	return is_valid;
}

async function wantAuthn(req: Request, res: Response) {
	try {
		// make sure theyre legit
		const req_uid = req?.session?.userId;
		const reqAddr = req.header('X-Forwarded-For');
		if (typeof req_uid === 'number' && typeof reqAddr === 'string') {
			// make the thing that has a key in it, i guess
			const product_key = generateMSProductKey();
			molehill.set(req_uid, product_key);
			// delete it eventually
			setTimeout(function() {
				molehill.delete(req_uid);
			}, 30000);
			// give him his key
			res.status(200).json({product_key, user_id: req_uid});
		} else {
			// looks like we're gonna have a problem, mate
			GIVE_UP(res, 'missing userId or X-Forwarded-For header');
		}
	} catch (errrrr) {
		console.error(errrrr);
		GIVE_UP(res, 'couldnt handle authn request');
	}
}

router.get("/please", wantAuthn);

export {router as rt_authn};
export {validProductKey};
export default router;
