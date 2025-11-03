import express from 'express';
import * as path from "node:path";
import { addUser, getUserByEmail, verifyPassword, updateJsonStorage, getJsonStorage } from './db'; // Import database functions
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
app.use(session({
		store: new RedisStore({ client: redisClient }),
		secret: getSecret(),
		resave: false,
		saveUninitialized: false,
		cookie: {
				secure: false, // Set to true in production if using HTTPS
				httpOnly: true, // Prevent client-side JS access
				path: "/api"
		}
}));

// Serve static files (like your index.html)
app.use(express.static(path.join(__dirname, "..", 'html')));

// Route Handlers
async function handleAdd(req: Request, res: Response) {
		const { email, username, password } = req.body;

		try {
				const result = await addUser(username, password, email);
				if (result) {
						res.status(201).json({ message: 'User added successfully!' });
				} else {
						res.status(500).json({ message: 'Failed to add user (DB failed or returned null).' });
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
		}
}

async function handleLogin(req: Request, res: Response) {
		const { email, password } = req.body;

		try {
				const user = await getUserByEmail(email);
				if (user && verifyPassword(password, user.PASSWORDHASH, user.SALT)) {
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
				const result = await updateJsonStorage(req.session.userId, data);
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
				const storageData = await getJsonStorage(req.session.userId);
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

// Define Routes
app.post('/api/users/add', handleAdd);
app.post('/api/users/login', handleLogin);
app.post('/api/users/logout', isAuthenticated, handleLogout);
app.get("/api/users/info", isAuthenticated, handleInfo);
app.post('/api/users/storage', isAuthenticated, handleSaveStorage); // Route to save JSON storage
app.get('/api/users/storage', isAuthenticated, handleGetStorage);   // Route to retrieve JSON storage

// Export the Express app
export default app;
