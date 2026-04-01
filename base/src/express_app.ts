import express from 'express';
import * as path from "node:path";
import * as odb from "./db";
import { Request, Response } from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

// Configure Redis client (assuming default setup on localhost:6379)
const redisClient = createClient({
		url: 'redis://localhost:6379'
});
redisClient.connect().catch(console.error);
redisClient.on('error', (err) => console.log('Redis Client Error', err));

const app = express();

app.set("x-powered-by", false);
app.set('trust proxy', true);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

declare module 'express-session' {
		interface SessionData {
				userId: number;
				username: string;
				email: string;
				storage: object;
				id: string;
		}
}

async function handleLogin(req: Request, res: Response) {
		const { email, password } = req.body;

		try {
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
import {SessionData} from 'express-session';
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

// =================================== this is all the punch stuff

var cog = console.log;

async function get_ip(req: Request, res: Response){
	const xff = req.header('X-Forwarded-For');
	res.setHeader('Content-Type', 'text/plain');
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.status(200).send(xff);
}

async function getPunchHtml(req: Request, res: Response){
	res.sendFile(path.join(__dirname, "..", 'html','punch.html'));
}

interface Punch {
	/**the IP address for someone */
	addr: string;
	/** this is the port for the service that client wants to advertise (ex: 2302) */
	port: number;
	/**this is the name of the server, for display purposes */
	serviceName : string;
	/**Who posted this?*/
	username: string;
}

async function getPunchList(req: Request, res: Response){
	try {
		let filteredView: Punch[] = [];
		let username = req.session.username;
		if (typeof username !== 'undefined'){
			const all_services = getPunchServices();

			if (all_services.length !== 0) {
				// we have some services

				// result is a Map<username, names of other users that he trusts>
				const result = await odb.getTrusts();
				if (result !== null){
					// only display services for users whom trust this user
					filteredView = all_services.filter(punch=>
						result.get(punch.username)?.includes(username) || punch.username === username
					);
				} else {
					// result was null, so for now we'll just limit it to same-username punches
					filteredView = all_services.filter(punch=>punch.username === username);					
				}
			} else {
				// we've got no services
			}
		} else {
			// the username ain't real, so we ignore him
		}

		res.status(200).json(filteredView);
	} catch (err) {
		console.error(err);
		res.status(500).json({msg:"error sorry"});
	}
}


async function askToJoin(req: Request, res: Response){
	try{
		const reqUsername = req.session.username;
		const reqAddr = req.header('X-Forwarded-For');		
		const reqPunch: Punch = req.body;
		if (typeof reqUsername === 'undefined' || typeof reqAddr === 'undefined' || typeof reqPunch === 'undefined') {
			// it's junk
			res.status(500).json({msg:"error with request"});
		} else {
			// we got a live one
			
			// get the client who is hosting this service
			const wsClient = getClientByService(reqPunch);
			if (typeof wsClient !== 'undefined') {
				const punchOut : Punch = {
					addr: reqAddr,
					port: reqPunch.port,
					serviceName: reqPunch.serviceName,
					username: reqUsername
				};

				if (reqUsername === reqPunch.username){
					// same-user, so we don't have to check the database for trust issues
					wsClient.send(JSON.stringify(punchOut));
					res.status(200).json({msg:'ok'});
				} else {
					// check odb for trust
					const result = await odb.getTrusts();
					if (result !== null){
						const isTrusted = result.get(reqPunch.username)?.includes(reqUsername);
						if (isTrusted) {
							// our guy is trusted
							wsClient.send(JSON.stringify(punchOut));
							res.status(200).json({msg:'ok'});
						} else {
							// user isnt trusted
							res.status(500).json({msg:"Target user doesn't trust you yet."});
						}
					} else {
						// result was null
						res.status(500).json({msg:"database error"});
					}
				}
			} else {
				// couldn't find a websocket client advertising this service
				res.status(500).json({msg:"Unable to find opponent"});
			}
		}
	} catch(err){
		console.error(err);
		res.status(500).json({msg:"error with join"});
	}
}

app.get("/ip", get_ip);
app.get("/punch", getPunchHtml);
app.get("/api/punch/list", isAuthenticated, getPunchList);
app.post("/api/punch/join", isAuthenticated, askToJoin);

// ===========================================================
// websocket server
import ws from 'ws';
import Stream from 'node:stream';
import http from 'node:http';

let wss: ws.WebSocketServer;

interface ClientData{
	/**The session ID*/
	sid: string;
	/**All the services that the client wants to list*/
	services: Punch[];
	/** the IP address of this client*/
	addr: string;
}

const clientMap: WeakMap<ws, ClientData> = new WeakMap();

// we need the server returned by app.listen()
export function initWSS (server : ws.ServerOptions["server"]) {
	wss = new ws.WebSocketServer({
		server,
		host: 'localhost',
		clientTracking: true,
		autoPong: true,
		path: '/wss'
	});
	wss.on('wsClientError', wss_onwsClientError);
	//wss.once('listening', wss_oncelistening);
	wss.on('connection', wss_onconnection);
}

function wss_oncelistening(){
	console.log('WSS OK', wss.address());
}

function wss_onconnection (ws : ws.WebSocket, req : Request) {
	const xff = req.headersDistinct['x-forwarded-for']?.at(0);
	const addr = xff??'';
	
	async function ws_onmessage (message : ws.RawData, isBinary: boolean){
		if (!isBinary){
			const rawMessage = message.toString();
			const parsedMessage = JSON.parse(rawMessage);

			if (typeof parsedMessage['Cookie'] !== 'undefined'){
				// client wants to set the session id
				let sid: string = parsedMessage['Cookie'];
				if (sid.includes('connect.sid=')){
					sid = sid.replace('connect.sid=','');
				}
				sid = decodeURIComponent(sid);
				const rx = /s:(.*?)\./;
				sid = rx.exec(sid)?.[1] ?? sid;
				const services: Punch[] = [];
				clientMap.set(ws, {sid, services, addr});

			} else {
				// client is listing services
				let clientData = clientMap.get(ws);
				if (typeof clientData !== 'undefined'){
					// check session info
					const sid = clientData.sid;
					const session: SessionData | undefined = await redisStore.get(sid);
					let username = session?.username ?? '';
					const services: Punch[] = parsedMessage;
					services.forEach(punch=>{
						punch.addr = addr;
						punch.username = username;
					});
					clientMap.set(ws, {sid, services, addr});
				} else {
					// clientData is undefined
				}
			}
		} else {
			// it's just a ping message
		}
	}
	ws.on('message', ws_onmessage);

	function ws_onceclose (code : number, reason : Buffer) {
		ws.off('message', ws_onmessage);
		clientMap.delete(ws);
	}
	ws.once('close', ws_onceclose);
}


function wss_onwsClientError (err : Error, socket: Stream.Duplex, request: http.IncomingMessage){
	console.error('WebSocket client error', err);
	console.error(socket);
	console.error(request);
}

function getPunchServices(): Punch[]{
	const all_services: Punch[] = [];
	// Set.prototype.map wasn't working for some reason
	wss.clients.forEach(ws=>{
		let clientData = clientMap.get(ws);
		if (typeof clientData !== 'undefined'){
		let services_perchance = clientData.services;
			all_services.push(...services_perchance);
		}
	});
	return all_services;
}

function getClientByService(search: Punch): ws | undefined {
	let foundClient: ws | undefined;

	searching: for (const client of wss.clients){		
		let clientData = clientMap.get(client);
		if (typeof clientData !== 'undefined'){
			for (const service of clientData.services) {
				if (service.addr === search.addr &&
				service.port === search.port && 
				service.serviceName === search.serviceName &&
				service.username === search.username){
					foundClient = client;
					break searching;
				}
			}
		}
	}

	return foundClient;
}

// Export the Express app
export {app as express_app};
