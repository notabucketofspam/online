import { generateMSProductKey } from './util_dump'; 

import {Request, Response, Router} from 'express';
const router = Router();

export async function createKey_II(req : Request, res : Response) {
  try {
    const newkey = generateMSProductKey();
		res.contentType('text/plain');
    res.status(200).send(newkey);
  } catch (err) {
    res.status(500).json({error: 'Internal server error'});
  }
}
router.get('/product-key', createKey_II);

export {router as rt_productkey};
