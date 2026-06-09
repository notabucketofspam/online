import express from 'express';
import * as path from "node:path";
import * as odb from "./db";
import { Request, Response } from 'express';
import session from 'express-session';
import {SessionData} from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import * as crypto from 'node:crypto';
import fs from 'node:fs';

// Configure Redis client (assuming default setup on localhost:6379)
const redisClient = createClient({
		url: 'redis://localhost:6379'
});
redisClient.connect().catch(console.error);
redisClient.on('error', function(err) {
	console.error(err);
	if (err?.code === "ECONNREFUSED"){
		console.log(`
		=======================
		You need to start redis
		=======================

		`);
		redisClient.destroy();
		setTimeout(function (){
			process.abort();
		}, 10000);
	}
});

const app = express();

app.set("x-powered-by", false);
app.set('trust proxy', true);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const useLocalhost = fs.existsSync('notkeys/use-localhost.txt');
import cors from 'cors';
const corsOptions = {
	origin: /waluigi-servebeer\.com$/,
	methods: ['GET', 'POST', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
	exposedHeaders: ['set-cookie'],
	preflightContinue: false,
	credentials: true,
};
if (!useLocalhost){
	app.use(cors(corsOptions));
}

function getSecret() {
		try {
				const secret = fs.readFileSync(path.normalize("keys/session_secret"), { encoding: null });
				return secret;
		} catch (err) {
				const secret = crypto.randomBytes(32);
				fs.writeFileSync(path.normalize("keys/session_secret"), secret, { encoding: null });
				return secret;
		}
}

// Configure session middleware with RedisStore
const redisStore = new RedisStore({ client: redisClient });

// session time
const sessionParser = session({
		store: redisStore,
		secret: getSecret(),
		resave: false,
		saveUninitialized: false,
		cookie: {
				secure: false, // Set to true in production if using HTTPS
				httpOnly: true, // Prevent client-side JS access
				path: "/api",
				maxAge: 8.64e9, // 100 days
		}
});
app.use(sessionParser);

// Serve static files (like your index.html)
app.use(express.static(path.join(__dirname, "..", 'html')));

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
			res.status(401).json({message: 'Invalid or expired token.'});
		}
	} catch (error: any) {
		console.error(error);
		res.status(500).json({ message: 'Failed to add user: ' + error.message });
	}
}


async function handleLogin(req: Request, res: Response) {

		try {
			const { email, password } = req.body;
				const user = await odb.getUserByEmail(email);
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

// Add this helper function to check if the user is authenticated
function isAuthenticated(req: Request, res: Response, next: express.NextFunction) {
	//console.log(req.session);
		if (req.session && req.session.userId) {
				// User is logged in
				return next();
		}
		// User is not logged in
		res.status(306).json({ message: 'Authentication required.' });
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
						return res.status(500).json({ message: 'Could not log out.' });
				}
				// Clears the session cookie in the browser
				res.clearCookie('connect.sid');
				res.json({ message: 'Logged out successfully.' });
		});
}

// --------------- this stuff is for the storage api ----------------------
// New route handler to save user's JSON storage
async function handleSaveStorage(req: Request, res: Response) {
		if (!req.session.userId) {
				return res.status(401).json({ message: 'Authentication required.' });
		}

		const data  = req.body; // Expect JSON data in the request body

		if (typeof data !== 'object' || data === null) {
				return res.status(400).json({ message: 'Invalid JSON data provided.' });
		}

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

// ------------- this is the section with the password reset stuffs -----------------
import * as emain from "./emain";

function generate_reset_token(){
	const token = crypto.generateKeySync('hmac',{length:64}).export().toString('hex');
	return token;
}

/**
 * this guy shall do the sending of the email
 * @param req
 * @param res
 */
async function handle_ask_for_token(req: Request, res: Response){

	const {email} = req.body;

	try{
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
	} catch(erro){
		console.error('error with the token thing', erro);
		res.sendStatus(500);
	}
}
/**
 * For when the user actually fills out the password reset form
 * @param req
 * @param res
 */
async function handlePasswordReset(req: Request, res: Response){

	const {email, password, token} = req.body;

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
				res.status(200).json({message: "aight you're good to go now :^)"});
			} else {
				res.status(500).json({message: "something went wrong. idk why :/"});
			}

		} else {
			// we got a problem, chief
			res.status(401).json({message: 'Invalid or expired token.'});
		}

	} catch (erro){
		console.error('ERROR in password reset form', erro);
		res.status(500).json({message:"some kinda snafu on our end. sorry pal."});
	}
}
/**
 * shall remove all of the sessions for a given user
 * @param email
 */
function clearSessionsByEmail(email: string){
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

/**
 * please dont use this function
 * @param req
 * @param res
 */
function handleMemes (req : Request, res : Response) {
	redisStore.all((err, sessions) => {
		if (err) {
			console.error('Error fetching sessions:', err);
		} else {
			console.log(sessions);
		}
	});
}

/**
 * delete a user account
 * @param req
 * @param res
 */
async function handleDelete (req : Request, res : Response) {
	try {
		if (typeof req?.session?.userId === "number") {
			const itWorked = await odb.deleteUser(req.session.userId);
			if (itWorked){
				if (typeof req?.session?.email === "string")
					clearSessionsByEmail(req.session.email);
				res.status(200).json({message: "account deleted" });
			} else {
				res.status(500).json({message: "couldn't delete account for some reason"});
			}
		}
	} catch (err) {
		res.status(500).json({message: "can't delete"});
	}
}

// Define Routes
app.post('/api/users/add', handleAdd);
app.post('/api/users/login', handleLogin);
app.post('/api/users/logout', isAuthenticated, handleLogout);
app.get("/api/users/info", isAuthenticated, handleInfo);
app.post('/api/users/storage', isAuthenticated, handleSaveStorage); // Route to save JSON storage
app.get('/api/users/storage', isAuthenticated, handleGetStorage);   // Route to retrieve JSON storage
app.post('/api/users/ask-for-token', handle_ask_for_token);
app.post('/api/users/password-reset', handlePasswordReset);
app.get("/api/users/delete", isAuthenticated, handleDelete);
//app.get('/api/users/memes', handleMemes);

export {redisStore, isAuthenticated, generate_reset_token};

// Export the Express app
export {app as express_app};
