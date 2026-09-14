import * as oracledb from 'oracledb';
import * as cron from 'cron';
import { express_app } from './express_app'; // Import the Express app
import { setPool, checkPlease } from './db'; // Import the setPool function
import { rt_users } from './api/users'; 
import {grandFacade} from './udp';
import {rt_punch, initWSS} from "./punch";
import {rt_productkey} from "./product_key";
import {rt_livekit } from "./livekit";
import {rt_banquet} from "./cdi/banquet";
import {rt_baltimore} from "./dmv/baltimore";
import {rt_goobo, initMichigan} from "./interstate";

import http from "node:http";
import stream from "node:stream";
import ws from "ws";

express_app.use("/api/users", rt_users);
express_app.use(rt_punch);
express_app.use(rt_productkey);
express_app.use(rt_livekit);
express_app.use(rt_banquet);
express_app.use("/api/dmv", rt_baltimore);
express_app.use("/goobo", rt_goobo);

import {astext} from "./util_dump";

process.env.TNS_ADMIN = "./wallet_ValuedCustomer/";

let pool: oracledb.Pool;

const job = new cron.CronJob('39 6 * * *', checkPlease);

const wsservers: Set<ws.WebSocketServer> = new Set();

async function init() {
	const user = astext("keys/db_user");
	const password = astext("keys/db_password");
	const connectString = "valuedcustomer_high";

	try {
		pool = await oracledb.createPool({
			user,
			password,
			connectString,
			configDir: "./wallet_ValuedCustomer/",
			walletLocation: "./wallet_ValuedCustomer/",
			walletPassword: astext("keys/wallet_pass")
		});

		// Set the database connection pool in the db module
		setPool(pool);

		const port = 39600;
		const server_real = express_app.listen(port, () => {
			console.log('\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/');
			console.log(`listening on ${port}`);
		});

		wsservers.add(initWSS());
		wsservers.add(initMichigan());
		server_real.on('upgrade', onupgrade);

		job.start();

		grandFacade();

	} catch (err) { console.error(err); }
}
init();

// Close the default connection pool with 1 second draining, and exit
async function closePoolAndExit() {
	console.log("\nTerminating []");
	try {
		await oracledb.getPool().close(1);
		process.exit(0);
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
}
// Close the pool cleanly if Node.js is interrupted
process
	.once('SIGTERM', closePoolAndExit)
	.once('SIGINT', closePoolAndExit);

async function onupgrade(request: http.IncomingMessage, socket: stream.Duplex, head: NonSharedBuffer) {
	try {
		let hasBeenHandled = false;
		for (const wss of wsservers) {
			if (wss.shouldHandle(request)) {
				hasBeenHandled = true;
				wss.handleUpgrade(request, socket, head, (ws) => {
					wss.emit('connection', ws, request);
				});
				break;
			}
		}
		if (!hasBeenHandled) {
			socket.destroy();
		}
	}catch(err) {
		console.error(err);
	}
}

