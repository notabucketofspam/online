/**
 * generate a very real Microsoft product key
 * @returns 
 */
export function generateMSProductKey() {
  const ALPHABET = "BCDFGHJKMPQRTVWXY2346789";
  const BASE = BigInt(ALPHABET.length);

  // The maximum possible value for a 25-digit base-24 number
  const maxVal = BASE ** 25n;

  // The maximum possible value for 120 bits
  const max120Bits = 2n ** 120n;

  // Calculate the 'fair' limit to prevent modulo bias
  // This chops off the uneven remainder at the very top of the 120-bit range
  const unbiasedLimit = max120Bits - (max120Bits % maxVal);

  const bytes = new Uint8Array(15);
  let num;

  // REJECTION SAMPLING:
  // Keep generating random bytes until we get a number strictly below the unbiased limit.
  do {
    crypto.getRandomValues(bytes);
    num = 0n;
    for (let i = 0; i < bytes.length; i++) {
      num = (num << 8n) | BigInt(bytes[i]!);
    }
  } while (num >= unbiasedLimit);

  // Now it is perfectly safe and unbiased to use modulo
  num = num % maxVal;

  let keyString = "";
  for (let i = 0; i < 25; i++) {
    let remainder = Number(num % BASE);
    keyString = ALPHABET[remainder] + keyString;
    num = num / BASE;
  }

  const parts = [];
  for (let i = 0; i < 25; i += 5) {
    parts.push(keyString.substring(i, i + 5));
  }

  return parts.join("-");
  // thanks gemini
}

import {Request, Response} from 'express';
import {generate_reset_token, isAuthenticated, express_app as app} from "./express_app";
import * as odb from "./db";

async function createKey(req : Request, res : Response) {
	try {
		const reqbody = req.body;
		let keyname = reqbody.keyname;
		if (!keyname || typeof keyname !== 'string') {
      keyname = generate_reset_token();
    }
    const newkey = generateMSProductKey();
    const userId = req.session.userId;
    if (typeof userId === 'number') {
			const result = await odb.updatePkeys(userId, {[newkey]: keyname});
			if (!result) {
				res.status(500).json({error: 'Failed to update product keys in the database'});
				return;
			}
    }
		res.status(200).json({name: keyname, key: newkey});
	} catch (err) {
		res.status(500).json({error: 'Internal server error'});
  }
}
app.post('/api/pkey/create', isAuthenticated, createKey);

async function listKeys(req : Request, res : Response) {
	try {
		const userId = req.session.userId;
		if (typeof userId === 'number') {
			const pkeys = await odb.getPkeys(userId);
			if (pkeys !== null) {
				res.status(200).json({pkeys});
      } else {
				res.status(500).json({error: 'Failed to retrieve product keys from the database'});
      }
		} else {
			res.status(401).json({error: 'worthless'});
			return;
    }
	} catch (err) {
		res.status(500).json({error: 'Internal server error'});
  }
}
app.get('/api/pkey/list', isAuthenticated, listKeys);

async function deleteKey(req : Request, res : Response) {
	try {
		const reqbody = req.body;
		const keyToDelete = reqbody.key;
		if (!keyToDelete || typeof keyToDelete !== 'string') {
			res.status(400).json({error: 'Invalid request body'});
			return;
		}
		const userId = req.session.userId;
		if (typeof userId === 'number') {
			const result = await odb.removeFromPkeys(userId, keyToDelete);
      if (result){
				res.status(200).json({message: 'Key deleted successfully'});
      } else {
        // no result
				res.status(500).json({error: 'Failed to delete the product key from the database'});
      }
    } else {
			// no user id
			res.status(401).json({error: 'wretched'});
    }
	} catch (err) {
		res.status(500).json({error: 'Internal server error'});
  }
}
app.post('/api/pkey/delete', isAuthenticated, deleteKey);

export async function createKey_II(req : Request, res : Response) {
  try {
    const newkey = generateMSProductKey();
		res.contentType('text/plain');
    res.status(200).send(newkey);
  } catch (err) {
    res.status(500).json({error: 'Internal server error'});
  }
}
app.get('/product-key', createKey_II);

