import { Request, Response, Router } from 'express';
import session from 'express-session';
import { SessionData } from 'express-session';
import * as odb from "./users_db";
import { getUserByEmail } from "../db";
import {
	redisClient,
	isAuthenticated,
	generate_reset_token,
	redisStore,
} from "../express_app"; 
import { despammer } from "../malware/norton.js";

// Route Handlers
async function handleAdd(req: Request, res: Response) {
	const { email, username, password, token } = req.body;
	try {
		const legalize_spare_drone_parts = await redisClient.get(`noob:${email}`);
		if (legalize_spare_drone_parts === token) {
			// the token is chill

			const result = await odb.addUser(username, password, email);
			if (result) {
				// adding the user is ok
				await redisClient.del(`noob:${email}`); // delete the used token
				res.status(200).json({ message: 'User added successfully!' });
			} else {
				res.status(500).json({ message: 'Failed to add user (DB failed or returned null).' });
			}
		} else {
			// invalid token
			res.status(401).json({ message: 'Invalid or expired token.' });
		}
	} catch (error: any) {
		console.error(error);
		res.status(500).json({ message: 'Failed to add user: ' + error.message });
	}
}

async function handleLogin(req: Request, res: Response) {
	try {
		const { email, password } = req.body;
		const user = await getUserByEmail(email);
		if (user && odb.verifyPassword(password, user.PASSWORDHASH, user.SALT)) {
			// Successful login: store user data in session
			req.session.userId = user.USERID;
			req.session.username = user.USERNAME;
			req.session.email = user.EMAIL;
			req.session.storage = user.STORAGE;

			res.json({ message: 'Login successful!' });
		} else {
			res.status(401).json({ message: 'Invalid credentials.' });
		}
	} catch (error: any) {
		console.error(error);
		res.status(500).json({ message: 'Login failed: ' + error.message });
	}
}

// Example of a protected route
function handleInfo(req: Request, res: Response) {
	// If we reach here, req.session is populated with the user data from Redis
	res.json({
		userId: req.session.userId,
		username: req.session.username,
		email: req.session.email
	});
};

// New Route Handler: Logout
async function handleLogout(req: Request, res: Response) {
	req.session.destroy((err) => {
		if (err) {
			console.error('Error destroying session:', err);
			res.status(500).json({ message: 'Could not log out.' });
		} else {
			// Clears the session cookie in the browser
			res.clearCookie('connect.sid');
			res.json({ message: 'Logged out successfully.' });
		}
	});
}

// --------------- this stuff is for the storage api ----------------------
// New route handler to save user's JSON storage
async function handleSaveStorage(req: Request, res: Response) {
	if (req.session.userId) {
		const data = req.body;
		if (data && typeof data === 'object') {
			try {
				const result = await odb.updateJsonStorage(req.session.userId, data);
				if (result) {
					req.session.storage = data; // Update session with new storage data
					res.json({ message: 'Storage updated successfully!' });
				} else {
					res.status(500).json({ message: 'Failed to update storage.' });
				}
			} catch (error: any) {
				console.error('Error saving storage:', error);
				res.status(500).json({ message: 'Failed to save storage: ' + error.message });
			}
		} else {
			return res.status(400).json({ message: 'Invalid JSON data provided.' });
		}
	} else {
		// no auth
		res.status(401).json({ message: 'Authentication required.' });
	}
}

// New route handler to retrieve user's JSON storage
async function handleGetStorage(req: Request, res: Response) {
	if (!req.session.userId) {
		return res.status(401).json({ message: 'Authentication required.' });
	}

	try {
		const storageData = await odb.getJsonStorage(req.session.userId);
		if (storageData) {
			req.session.storage = storageData;
			res.json({ storage: storageData });
		} else {
			// If no storage data is found, return an empty object
			res.json({ storage: {} });
		}
	} catch (error: any) {
		console.error('Error retrieving storage:', error);
		res.status(500).json({ message: 'Failed to retrieve storage: ' + error.message });
	}
}

// ======================================================================================
// ------------- this is the section with the password reset stuffs -----------------
import * as emain from "../emain";

/**
 * this guy shall do the sending of the email
 * @param req
 * @param res
 */
async function handle_ask_for_token(req: Request, res: Response) {

	const { email } = req.body;

	try {
		const looks_legit = await odb.checkIfUserIsReal(email);
		let keyfix = "pwrt";

		if (looks_legit) {
			// this is a real person
		} else {
			// i dont know you

			// we are assuming that mr. user wants to create a new account.
			// because we are **efficient**, this is gonna mostly
			// reuse the same bits as the "password reset" stuffs.
			keyfix = "noob";
		}

		const token = generate_reset_token();

		// deal with redis and her shenanigans
		const timeToKill = await redisClient.ttl(`${keyfix}:${email}`);

		// we're only gonna send a token if it's been a lil while
		if (timeToKill < 600) {
			await redisClient.setEx(`${keyfix}:${email}`, 1000, token);

			// sending the email now			
			const not_ok = await emain.craft(email, token, keyfix);
			if (not_ok) {
				console.log('something went wrong with the email sending');
			}
		}

		// you get a thumbs-up either way
		res.sendStatus(200);
	} catch (erro) {
		console.error('error with the token thing', erro);
		res.sendStatus(500);
	}
}

/**
 * For when the user actually fills out the password reset form
 * @param req
 * @param res
 */
async function handlePasswordReset(req: Request, res: Response) {

	const { email, password, token } = req.body;

	try {
		const heslegit = await redisClient.get(`pwrt:${email}`);
		if (heslegit === token) {
			// ok, the token looks good

			const update_ok = await odb.updateUserPassword(email, password);
			if (update_ok) {
				// the password updated fine,
				// so now we gotta clear any remaining sessions for this user.
				// this part's not as bad as it used to be
				clearSessionsByEmail(email);

				// delete the used token
				await redisClient.del(`pwrt:${email}`);
				res.status(200).json({ message: "aight you're good to go now :^)" });
			} else {
				res.status(500).json({ message: "something went wrong. idk why :/" });
			}

		} else {
			// we got a problem, chief
			res.status(401).json({ message: 'Invalid or expired token.' });
		}

	} catch (erro) {
		console.error('ERROR in password reset form', erro);
		res.status(500).json({ message: "some kinda snafu on our end. sorry pal." });
	}
}

/**
 * shall remove all of the sessions for a given user
 * @param email
 */
function clearSessionsByEmail(email: string) {
	redisStore.all((err, sessions) => {
		if (err) {
			console.error('Error fetching sessions:', err);
		} else {
			(sessions as SessionData[]).forEach(session => {
				if (session?.email === email) {
					redisStore.destroy(session?.id, (err) => {
						if (err) {
							console.error(`Error destroying session ${session?.id}:`, err);
						}
					}); // destroy
				} // if email
			}); // forEach
		} // if err...else
	}); // all
}

// ======================================================================================
//											DELETE A USER ACCOUNT

/**
 * delete a user account
 * @param req
 * @param res
 */
async function handleDelete(req: Request, res: Response) {
	try {
		if (typeof req?.session?.userId === "number") {
			const itWorked = await odb.deleteUser(req.session.userId);
			if (itWorked) {
				if (typeof req?.session?.email === "string")
					clearSessionsByEmail(req.session.email);
				res.status(200).json({ message: "account deleted" });
			} else {
				res.status(500).json({ message: "couldn't delete account for some reason" });
			}
		}
	} catch (err) {
		res.status(500).json({ message: "can't delete" });
	}
}

const router = Router();

// Define Routes
router.post('/add', handleAdd);
router.post('/login', handleLogin);
router.post('/logout', isAuthenticated, handleLogout);
router.get("/info", isAuthenticated, handleInfo);
router.post('/storage', isAuthenticated, handleSaveStorage); // Route to save JSON storage
router.get('/storage', isAuthenticated, handleGetStorage);   // Route to retrieve JSON storage
router.post('/ask-for-token', despammer, handle_ask_for_token);
router.post('/password-reset', despammer, handlePasswordReset);
router.get("/delete", isAuthenticated, handleDelete);

export { router as rt_users};
