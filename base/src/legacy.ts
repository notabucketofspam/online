import path from 'path';

import { Request, Response, Router } from 'express';
import express from 'express';

import {
	generateMSProductKey,
	msdir
} from './util_dump.ts';

const router = Router();

async function createKey_II(req : Request, res : Response) {
  try {
    const newkey = generateMSProductKey();
		res.contentType('text/plain');
    res.status(200).send(newkey);
  } catch (err) {
    res.status(500).json({error: 'Internal server error'});
  }
}
router.get('/product-key', createKey_II);

function get_ip(req: Request, res: Response) {
	try {
		const xff = req.header('X-Forwarded-For');
		res.setHeader('Content-Type', 'text/plain');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(200).send(xff);
	} catch (err) {
		res.status(500).send({ msg: "error sorry" });
	}
}
router.get("/ip", get_ip);

// ========================================================
// and this is a whole bunch of static routes

router.use("/account", express.static(msdir("html","users")));
router.use("/punch", express.static(msdir("html", "punch")));
router.use("/livekit", express.static(msdir("html", "livekit")));
router.use("/goobo", express.static(msdir("html", "goobo"), {
	index: "classic.html", 
	fallthrough:true
}));
router.use("/goobo", express.static(msdir("dist","goobo"), {
	extensions: ['js']
}));
router.use("/online/captcha", express.static(msdir("html", "captcha")));
router.use("/online/registrar", express.static(msdir("html", "office-of-the-registrar")));

export {router as rt_legacy};
