import path from "node:path";
import crypto from 'node:crypto';
import fs from 'node:fs';

import express from 'express';
import { RedisStore } from 'connect-redis';
import { Request, Response } from 'express';
import session from 'express-session';
import { createClient } from 'redis';
import cors from 'cors';

import { SessionData } from 'express-session';

/**her name is Redis*/
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

/**the man, the king of only, this is it luigi*/
const app = express();

app.set("x-powered-by", false);
app.set('trust proxy', true);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// use cors (perchance)
const useLocalhost = fs.existsSync('notkeys/use-localhost.txt');
const corsOptions = {
	origin: /waluigi-servebeer\.com$/,
	methods: ['GET', 'POST', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
	exposedHeaders: ['set-cookie'],
	// preflightContinue: false,
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
		httpOnly: true,
		path: "/api",
		maxAge: 8.64e9, // 100 days
	}
});
app.use(sessionParser);

/**check if the user is authenticated */
function isAuthenticated(req: Request, res: Response, next: express.NextFunction) {
	if (req.session && req.session.userId) {
		// User is logged in
		return next();
	} else {
		// User is not logged in
		res.status(306).json({ message: 'Authentication required.' });
	}
}

function generate_reset_token(){
	const token = crypto.generateKeySync('hmac',{length:64}).export().toString('hex');
	return token;
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
//app.get('/api/users/memes', handleMemes);

export {
	redisStore,
	isAuthenticated,
	generate_reset_token,
	redisClient,
	app as express_app,
};
