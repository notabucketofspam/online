import * as oracledb from 'oracledb';
import * as crypto from 'node:crypto';

// Define the database connection pool (it will be initialized in main.ts)
let pool: oracledb.Pool;

// Function to set the database connection pool
export function setPool(dbPool: oracledb.Pool) {
		pool = dbPool;
}

// Define the User interface
interface User {
		USERID: number;
		USERNAME: string;
		PASSWORDHASH: string;
		EMAIL: string;
		REGISTRATIONDATE: string;
		SALT: string;
		STORAGE: object; // Changed from string to object to reflect native JSON type
}

// Function to execute a database query
async function queryDatabase(sql: string, params: oracledb.BindParameters, commit = false, options?: oracledb.ExecuteOptions) {
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
				console.error('Error executing query:', err);
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

// Function to add a new user to the database
export async function addUser(username: string, password: string, email: string) {
		const { salt, passwordHash } = hashPassword(password);
		const sql = `
				INSERT INTO Users (USERNAME, PASSWORDHASH, SALT, EMAIL, STORAGE)
				VALUES (:username, :passwordHash, :salt, :email, :storage)
		`;
		const storage = { val: {}, type: oracledb.DB_TYPE_JSON }; // Initialize with an empty JavaScript object
		const params = { username, passwordHash, salt, email, storage }; // Pass the JavaScript object directly

		try {
				const result = await queryDatabase(sql, params, true);
				console.log('User added successfully');
				return result;
		} catch (error) {
				console.error('Error adding user:', error);
				return null;
		}
}

// Function to get a user by email from the database
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

// Function to hash a password using scrypt
function hashPassword(password: crypto.BinaryLike) {
		// 1. Generate a random salt
		const salt = crypto.randomBytes(16).toString('hex'); // 16 bytes is a good size
		// 2. Hash the password with the salt
		const passwordHash = crypto.scryptSync(password, salt, 64, { N: 1024 }).toString('hex');
		// 3. Return the salt and the hashed password
		return { salt, passwordHash };
}

// Function to verify a password against a stored hash and salt
export function verifyPassword(password: crypto.BinaryLike, passwordHash: string, salt: crypto.BinaryLike) {
		// Hash the provided password with the stored salt
		const hashedAttempt = crypto.scryptSync(password, salt, 64, { N: 1024 }).toString('hex');
		// Compare the generated hash with the stored hash
		return hashedAttempt === passwordHash;
}

// New function to update a user's JSON storage
export async function updateJsonStorage(userId: number, jsonData: object): Promise<boolean> {
		const sql = `UPDATE users
									SET storage =
										json_mergepatch(storage, :bv)									
									WHERE USERID = :userId`;
		const params = { bv: { val: jsonData, type: oracledb.DB_TYPE_JSON }, userId }; // Pass the JavaScript object directly
		try {
				const result = await queryDatabase(sql, params, true);
				return result.rowsAffected === 1;
		} catch (error) {
				console.error("Error updating JSON storage:", error);
				throw error;
		}
}

// New function to retrieve a user's JSON storage
export async function getJsonStorage(userId: number): Promise<object | null> {
		const sql = `SELECT STORAGE FROM USERS WHERE USERID = :userId`;
		const params = { userId };
		try {
				const result = await queryDatabase(sql, params, false, { outFormat: oracledb.OUT_FORMAT_OBJECT });
				if (result && result.rows && result.rows.length > 0) {
						// OracleDB automatically converts the native JSON type to a JavaScript object
						return (result.rows[0] as User).STORAGE as object;
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
