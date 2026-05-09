import * as path from "node:path";
import * as fs from "node:fs";
import * as oracledb from 'oracledb';
import * as cron from 'cron';
import { express_app } from './express_app'; // Import the Express app
import { setPool, checkPlease } from './db'; // Import the setPool function
import {grandFacade} from './udp';
import {initWSS} from "./punch";
import "./product_key";

const astext = (x: string) => fs.readFileSync(path.normalize(x), { encoding: "utf8" });

process.env.TNS_ADMIN = "./wallet_ValuedCustomer/";

let pool: oracledb.Pool;

const job = new cron.CronJob('39 6 * * *', checkPlease);

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
						console.log(`listening on ${port}`);
				});
				initWSS(server_real);

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

