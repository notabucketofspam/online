import path from "node:path";
import os from "node:os";
import {Request, Response} from "express";

import {express_app as app} from "../express_app";
import {getWhatsOnDeck} from "./garbage_island";

const contentpath = path.join(os.tmpdir(), "wsbc_banquet");

// NOTE: 8.64e7 ms is the same as 1440 min or one day
// using less bc testing right now

const maxfresh = 8.64e5;
async function banquetProMax(req: Request, res: Response) {
  try {
		const bindo = await getWhatsOnDeck({}, contentpath, maxfresh);
    if (bindo){
      // send the bindo
			res.status(200).contentType("image/png").send(bindo);
    } else {
      // lol idk what happened
      res.status(500).json({error: "sorry nothing"});
    }
  } catch (er) {
    res.status(500).json({error: "Couldn't find any food."});
  }
}
app.get("/api/cdi/banquet", banquetProMax);

