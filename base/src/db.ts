import * as oracledb from 'oracledb';

// Define the database connection pool (it will be initialized in main.ts)
let pool: oracledb.Pool;

// Function to set the database connection pool
export function setPool(dbPool: oracledb.Pool) {
	pool = dbPool;
}

// Define the User interface
export interface User {
	USERID: number;
	USERNAME: string;
	PASSWORDHASH: string;
	EMAIL: string;
	REGISTRATIONDATE: string;
	SALT: string;
	STORAGE: object; // Changed from string to object to reflect native JSON type
	PKEYS: object;
}

// Function to execute a database query
export async function queryDatabase(sql: string, params: oracledb.BindParameters, commit = false, options?: oracledb.ExecuteOptions) {
	let connection;
	try {
		connection = await pool.getConnection(); // Get a connection from the pool

		let result;
				if (options){
			result = await connection.execute(sql, params, options);
		} else {
			result = await connection.execute(sql, params);
		}

		if (commit)
			await connection.commit(); // Commit if needed
		return result;
	} catch (err) {
		// console.error('Error executing query:', err);
		if (commit && connection) {
			try {
				await connection.rollback(); // Rollback if there was an error during a transaction
			} catch (rollbackErr) {
				console.error('Error during rollback:', rollbackErr);
				throw rollbackErr; // Re-throw the rollback error
			}
		}
		throw err; // Re-throw the error
	} finally {
		if (connection) {
			try {
				await connection.close(); // Return the connection to the pool
			} catch (closeErr) {
				console.error('Error closing connection:', closeErr);
				throw closeErr; // Re-throw the close error
			}
		}
	}
}

export async function getUserByEmail(email: string): Promise<User | null> {
	const sql = 'SELECT * FROM USERS WHERE EMAIL = :email';
	const params = { email };
	try {
		const result = await queryDatabase(sql, params, false, { outFormat: oracledb.OUT_FORMAT_OBJECT });

		if (result && result.rows && result.rows.length > 0) {
					const user : User = result.rows[0] as User; // Directly assign the row as User
			return user; // Return the first user with the matching email
		}
		return null;
	} catch (err) {
		console.error('Error getting user:', err);
		return null;
	}
}



/**
 * 
 * @param userId
 * @param jsonData
 * @returns
 */
export async function updatePkeys(userId : number, jsonData : object) : Promise<boolean> {
	const sql = `UPDATE users
									SET pkeys =
										json_mergepatch(pkeys, :bv)
									WHERE USERID = :userId`;
	const params = {bv: {val: jsonData, type: oracledb.DB_TYPE_JSON}, userId}; // Pass the JavaScript object directly
	try {
		const result = await queryDatabase(sql, params, true);
		return result.rowsAffected === 1;
	} catch (error) {
		console.error("Error updating PKEYS:", error);
		throw error;
	}
}
/**
 * 
 * @param userId
 * @returns
 */
export async function getPkeys(userId : number) : Promise<object | null> {
	const sql = `SELECT PKEYS FROM USERS WHERE USERID = :userId`;
	const params = {userId};
	try {
		const result = await queryDatabase(sql, params, false, {outFormat: oracledb.OUT_FORMAT_OBJECT});
		if (result && result.rows && result.rows.length > 0) {
			return (result.rows[0] as User).PKEYS as object;
		}
		return null;
	} catch (error) {
		console.error("Error retrieving PKEYS:", error);
		throw error;
	}
}
export async function removeFromPkeys(userId : number, keyToRemove : string) : Promise<boolean> {
	const escapedKey = keyToRemove
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/'/g, "''");
	const jsonPath = `$."${escapedKey}"`;
	const sql = `UPDATE users
									SET pkeys =
										json_transform(pkeys, REMOVE '${jsonPath}')
									WHERE USERID = :userId`;
	const params = { userId };
	try {
		const result = await queryDatabase(sql, params, true);
		return result.rowsAffected === 1;
	} catch (error) {
		console.error("Error deleting from PKEYS:", error);
		throw error;
	}
}


type Trusts = [string, string[]];
export async function getTrusts(): Promise<Map<string, string[]> | null> {
	const sql = `SELECT username, JSON_QUERY(storage, '$.trusts')
    FROM users WHERE JSON_EXISTS(storage, '$.trusts')`;
	const params = {};
	try {
		const result = await queryDatabase(sql, params, false);
		if (result && result.rows && result.rows.length > 0) {
			const rows = result.rows as Trusts[];
			return new Map(rows);
		}
		return null;
	} catch (error) {
		console.error("Error retrieving JSON storage:", error);
		throw error;
	}
}

export async function checkPlease() {
	const sql = "insert into misc values (default, default)";
	const params = {};
	try {
		const result = await queryDatabase(sql, params, true);
	} catch (error) {
		console.error(error);
	}
}






