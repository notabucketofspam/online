import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import {Request, Response} from "express";

import {rember} from "../util_dump";
import {express_app as app} from "../express_app";
import {getWhatsOnDeck} from "./garbage_island";

const contentpath = path.join(os.tmpdir(), "wsbc_banquet");

// NOTE: 8.64e7 ms is the same as 1440 min or one day
// using less bc testing right now

const maxfresh = 8.64e5;
async function banquetProMax(req: Request, res: Response) {
  try {
		const bindo = await getWhatsOnDeck(banquetPrompt(), contentpath, maxfresh);
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

const banquetPrompt = () => ({
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": crypto.randomInt(2**48-1),
      "steps": 8,
      "cfg": 1.5,
      "sampler_name": "euler",
      "scheduler": "sgm_uniform",
      "denoise": 1,
      "model": ["4",0],
      "positive": ["6",0],
      "negative": ["7",0],
      "latent_image": ["5",0]
    },
  },
  "4": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "sdxl_lightning_8step.safetensors"
    },
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    },
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": `A frozen dinner package with the words ("${rember(adj)} ${rember(noun)}":1.3), sitting on a shelf.`,
      "clip": ["4",1]
    },
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "",
      "clip": ["4",1]
    },
  },
  "8": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["3",0],
      "vae": ["4",2]
    },
  },
  "9": {
    "class_type": "SaveImage",
    "inputs": {
      "filename_prefix": "wsbc_banquet",
      "images": ["8",0]
    },
  }
});

const adj = [
  "EXTRA", "EXTRA", "EXTRA", "EXTRA",
  "EXTRA", "EXTRA", "BONUS", 
  "EXTRA", "EXTRA", "MORE", "EXTRA", 
  "EXTRA", "EXTRA", "100% NATURAL",
  "VERY", "REDUCED",
];
const noun = [
  "BEANS", "LONG", "CALORIES", "SAUCE",
  "SO-DIMM SLOTS", "BANQUET", "SONGS",
  "NATURAL", "POP", "GRUNGE", "PARTICLES",
  "PLOP", "TEXTURE", "'CRAB'", 
  "SPECIAL", "GUILT",
];

