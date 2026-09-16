import * as oracledb from 'oracledb';
import crypto from 'node:crypto';
import session from 'express-session';
import { SessionData } from 'express-session';

import { queryDatabase, User } from "../db";
import { redisStore } from "../express_app"; 

// ======================================================================================
// Function to add a new user to the database
export async function addUser(username: string, password: string, email: string) {
	const { salt, passwordHash } = hashPassword(password);
	const sql = `
				INSERT INTO Users (USERNAME, PASSWORDHASH, SALT, EMAIL, STORAGE, PKEYS)
				VALUES (:username, :passwordHash, :salt, :email, :storage, :pkeys)
		`;
	const storage = { val: {}, type: oracledb.DB_TYPE_JSON };
	const pkeys = { val: {}, type: oracledb.DB_TYPE_JSON };
	const params = { username, passwordHash, salt, email, storage, pkeys };

	try {
		const result = await queryDatabase(sql, params, true);
		console.log('User added successfully');
		return result;
	} catch (error) {
		console.error('Error adding user:', error);
		return null;
	}
}
/**hash a password using scrypt */
function hashPassword(password: crypto.BinaryLike) {
	// generate random salt
	// 16 bytes is a good size
	const salt = crypto.randomBytes(16).toString('hex');

	// hash the password with the salt
	const passwordHash = crypto.scryptSync(password, salt, 64, { N: 1024 }).toString('hex');

	// return the salt and the hashed password
	return { salt, passwordHash };
}

/**verify a password against a hash and salt */
export function verifyPassword(password: crypto.BinaryLike, passwordHash: string, salt: crypto.BinaryLike) {
	// Hash the provided password with the stored salt
	const hashedAttempt = crypto.scryptSync(password, salt, 64, { N: 1024 }).toString('hex');

	// Compare the generated hash with the stored hash
	return hashedAttempt === passwordHash;
}

// ======================================================================================
//										these are mostly used for the password reset things


export async function checkIfUserIsReal(email: string) {
	const sql = `SELECT EMAIL FROM USERS WHERE EMAIL = :email`;
	const params = { email };
	try {
		const result = await queryDatabase(sql, params, false);
		if (result && result.rows && result.rows.length > 0) {
			return true;
		} else {
			return false;
		}
	} catch (error) {
		console.error(error);
		// eh, assume that it's the user's fault this time
		return false;
	}
}
/**
 * shall remove all of the sessions for a given user
 * @param email
 */
export function clearSessionsByEmail(email: string) {
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
export async function updateUserPassword(email: string, password: string) {

	const { salt, passwordHash } = hashPassword(password);

	const sql =
		`UPDATE USERS SET
		PASSWORDHASH = :passwordHash,
		SALT = :salt
	WHERE EMAIL = :email`;
	const params = { passwordHash, salt, email };
	try {
		const result = await queryDatabase(sql, params, true);
		return result.rowsAffected === 1;
	} catch (error) {
		console.error(error);
		throw error;
	}
}

// ======================================================================================
//											the storage api :^)

export async function updateJsonStorage(userId: number, jsonData: object): Promise<boolean> {
	const sql = `UPDATE users
									SET storage =
										json_mergepatch(storage, :bv)									
									WHERE USERID = :userId`;
	const params = { bv: { val: jsonData, type: oracledb.DB_TYPE_JSON }, userId };
	try {
		const result = await queryDatabase(sql, params, true);
		return result.rowsAffected === 1;
	} catch (error) {
		console.error("Error updating JSON storage:", error);
		throw error;
	}
}

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

// ======================================================================================
//									DELETE A USER ACCOUNT
export async function deleteUser(userId: number) {
	const sql = `DELETE FROM USERS WHERE USERID = :userId`;
	const params = { userId };
	try {
		const result = await queryDatabase(sql, params, true);
		return result.rowsAffected === 1;
	} catch (error) {
		console.error(error);
		throw error;
	}
}

