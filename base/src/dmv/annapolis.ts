import {Response} from 'express';
import {SnowflakeGenerator} from "./SnowflakeGenerator";
import {queryDatabase} from "../db";
import {isAuthenticated} from "../express_app";

/**does exactly what it says on the tin*/
function GIVE_UP(res:Response, error:string){
	res.status(500).json({error});
}

const workerId = process.env.WORKER_ID ? Number(process.env.WORKER_ID) : 0;
/**BIRDS ARENT REAL*/
const pidgen = new SnowflakeGenerator(workerId);

// export all that stuff
export {
	GIVE_UP,
	pidgen,
	isAuthenticated, 
	queryDatabase,
};
