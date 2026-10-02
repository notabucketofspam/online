import https from "node:https";
import { Buffer } from "node:buffer";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

import { Request, Response, Router } from "express";
import { astext_p, rember, rui } from "../util_dump.ts";
import { getWhatsOnDeck } from "./garbage_island.ts";
import { noun, adj } from "./banquet.ts";

const router = Router();
const contentpath = path.join(os.tmpdir(), "wsbc_banquet_neo");
const maxfresh = 8.64e5;

async function banquet_NEO(req: Request, res: Response) {
	try {
		const bindo = await getWhatsOnDeck(trigonometry, contentpath, maxfresh);
		if (bindo) {
			res.status(200).contentType("image/jpeg").send(bindo);
		} else {
			res.status(500).json({ error: "no food?" });
		}
	} catch (er) {
		res.status(500).json({ error: "Scram, kid." });
	}
}
router.get("/", banquet_NEO);
export { router as rt_banquet_NEO };

/**this is our cauldron function*/
async function trigonometry(): Promise<Buffer | null> {
	let labeouf: Buffer | null = null;
	try {
		const promptext = generatePromptText();
		const the_request = gemini_request_body(promptext);
		const result = await gemini_request(the_request);
		if (result) {
			labeouf = Buffer.from(result, "base64");
		}
	} catch (errnon) {
		console.error("LaBeouf problem:", errnon);
	}
	return labeouf;
}

interface GeminiRequest {
	model: string;
	input: {
		type: "text";
		text: string;
	};
	generation_config: {
		temperature: number;
		max_output_tokens: number;
		top_p: number;
		top_k: number;
		thinking_level: "minimal";
		image_config: {
			aspect_ratio: string;
			image_size: string;
		};
	};
	response_modalities: string[];
	service_tier: "flex";
}

/**generate the body that we gotta use in the request*/
function gemini_request_body(prompt: string): GeminiRequest {
	return {
		"model": "models/gemini-3.1-flash-lite-image",
		"input": {
			"type": "text",
			"text": prompt
		},
		"generation_config": {
			"temperature": 1,
			"max_output_tokens": 65536,
			"top_p": 1,
			"top_k": 64,
			"thinking_level": "minimal",
			"image_config": {
				"aspect_ratio": "1:1",
				"image_size": "1K"
			}
		},
		"response_modalities": ["image"],
		"service_tier": "flex"
	};
}

/**somewhat-randomly generate some text for the prompt*/
function generatePromptText(): string {
	let k = 1 + rui(3);
	let somewords = [];
	for (let i = 0; i < k; i++) {
		somewords.push(`"${rember(adj)} ${rember(noun)}"`);
	}
	let the_phrase = '';
	if (k === 1) {
		the_phrase = `${somewords[0]}`;
	} else if (k === 2) {
		the_phrase = `${somewords[0]} and ${somewords[1]}`;
	} else {
		the_phrase = `${somewords[0]}, ${somewords[1]}, and ${somewords[2]}`;
	}
	let the_prompt = `A package of Banquet frozen dinner with the words ${the_phrase}, sitting on a freezer shelf in a store.`;
	return the_prompt;
}

/**actually send it*/
async function gemini_request(the_request: GeminiRequest): Promise<string> {
	let ostrich = '';
	try {
		const GEMINI_API_KEY = await astext_p("./keys/GEMINI_API_KEY_paid");
		const headers = {
			'Content-Type': 'application/json',
			'x-goog-api-key': GEMINI_API_KEY
		};
		const endpoint_NEO = `https://generativelanguage.googleapis.com/v1beta/interactions`;
		const body = JSON.stringify(the_request);
		const response = await fetch(endpoint_NEO, {
			method: 'POST',
			headers,
			body,
		});
		const json = await response.json();
		const steps = json?.steps;
		if (steps instanceof Array) {
			let our_step = steps.find((step: any) => step?.type === 'model_output');
			if (our_step) {
				const content = our_step?.content;
				if (content instanceof Array) {
					let our_content = content.find((c: any) => c?.type === 'image');
					if (our_content) {
						ostrich = our_content?.data;
					}
				}
			}
		}
	} catch (err) {
		console.error('Error during Gemini request:', err);
	}
	return ostrich;
}

interface GeminiRequest_II {
	model: string;
	contents: {
		parts: {
			text: string;
		}[];
		role: string;
	}[];
	generationConfig: {
		maxOutputTokens: number;
		temperature: number;
		topP: number;
		topK: number;
		responseMimeType: string;
		responseModalities: string[];
	};
	thinkingConfig: {
		includeThoughts: boolean;
		thinkingLevel: "MINIMAL";
	};
}
