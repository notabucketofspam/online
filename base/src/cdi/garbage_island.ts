import path from "node:path";
import fs from "node:fs";
import {Buffer} from "node:buffer";
import {generateMSProductKey} from "../product_key";
import {astext} from "../util_dump";

/**
 * this is the function that we use to generate an image with the EVGA FTW GTX 1080
 */
export async function generateTrash(prompt:object) {
	return await new Promise<Buffer|null>(function(resolve, reject) {
		/**the buffer that has the final image in it*/
		let resb: Buffer | null;

		const endpoint = astext(path.join(process.cwd(),'keys','garbage_island'));
		const client_id = generateMSProductKey();
	
		const socket = new WebSocket(`ws://${endpoint}/ws?clientId=${client_id}`);

		function socket_onOpen() {
			fetch(`http://${endpoint}/prompt`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({prompt,client_id})
			}).catch(function(er){
				console.error("Failed to send prompt:", er);
				socket.close();
			});
		}
		function socket_onMessage(ev: MessageEvent) {
			if (!(ev.data instanceof Blob || Buffer.isBuffer(ev.data))) try {
				const message = JSON.parse(ev.data.toString());
				if (message.type === 'executed' && message.data.output?.images) {
					// this is (probably) the image that we want
					const img = message.data.output.images[0];
					const iurl = `http://${endpoint}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`
					fetch(iurl).then(res=>res.arrayBuffer()).then(buf=>{
						resb = Buffer.from(buf);
						// we got what we came for, so gtfo
						socket.close();
					});
				} else {
					// we literally dont care about anything else
				}
			} catch (err) {
				// probably just a JSON parsing error, so ignore
			}	else {
				// this was a binary message, so ignore it
			}
		}
		function socket_onError() {
			// GIVE UP.
			socket.close();
		}
		// give up after awhile, to prevent from stalling
		let giveup_timer = setTimeout(function() {
			socket.close();
		}, 300e3);
		function socket_onClose() {
			// (try to) remove the event listeners / timer
			try {
				socket.removeEventListener('open', socket_onOpen);
				socket.removeEventListener('message', socket_onMessage);
				socket.removeEventListener('error', socket_onError);
				socket.removeEventListener('close', socket_onClose);
				clearTimeout(giveup_timer);
			} catch(er){}
			// and now we determine what we are giving back
			if (resb){
				// Ladies and gentlemen, we got him.
				resolve(resb);
			} else {
				// we got nothing
				reject(resb);
			}
		}

		// add all thos event listeners
		socket.addEventListener('open', socket_onOpen);
		socket.addEventListener('message', socket_onMessage);
		socket.addEventListener('error', socket_onError);
		socket.addEventListener('close', socket_onClose);
	});
}

/**
 * check the freshness of a content file.
 * if he's stale, give nothing.
 * if he's hella fresh, return our man.
 */
async function chkfresh(fname: string, fresh: number) {
	let lastcontent: Buffer | null = null;
	try {
		// try to read the content file
		const fd = await fs.promises.open(fname, 'r+');
		const staten = await fd.stat();
		if (Date.now() - staten.mtimeMs > fresh) {
			// ... it's kinda old
		} else {
			// ... it's adequately fresh
			lastcontent = await fd.readFile({encoding: null});
		}

		//get that guy outta here
		await fd.close();
	} catch (erro) {
		// looks like there's no content file
	}
	return lastcontent;
}
/**
 * pretty much, if we dont have a fresh-enough content file, then:
 * - we give the user back the one that's on-deck, if possible
 * - we generate a new man
 */
export async function getWhatsOnDeck(prompt: object, fname: string, fresh: number) {
	let content: Buffer | null = null;
	try {
		// check existing content
		const lastcontent_maybe = await chkfresh(fname, fresh);
		if (lastcontent_maybe) {
			// Man Adequate
			content = lastcontent_maybe;
		} else {
			// man inadequate
			const fname_next = fname+'.next';
			const nextcontent_hopefully = await chkfresh(fname_next, 0);
			if (nextcontent_hopefully) {
				// That's him, officer.
				content = nextcontent_hopefully;
				// do not wait for him to die
				fs.promises.rename(fname_next, fname)
					.then(() => fs.promises.utimes(fname, new Date(), new Date()))
					.then(() => manMeaSand(prompt, fname_next))
					.catch(er=>console.error);
			} else {
				// we have neither of them
				// generate at least one new guy. we have to wait this time.
				const aBrandNewMan = await generateTrash(prompt);
				if (aBrandNewMan) {
					content = aBrandNewMan;
					// do not wait for the next one
					fs.promises.writeFile(fname, aBrandNewMan)
						.then(() => manMeaSand(prompt, fname_next))
						.catch(er=>console.error);
				} else {
					// we are so screwed
				}
			}
		}
	} catch(err) {
		// something has gone horribly wrong
		console.error(err);
	}
	return content;
}

/**
 * Mr. Sandman, man me a sand
 * make him the cutest man car door hook hand
 */
async function manMeaSand(prompt: object, fname: string) {
	try {
		const buf = await generateTrash(prompt);
		if (buf) {
			await fs.promises.writeFile(fname, buf);
		} else {
			// well, cant say we didnt try lol
		}
	} catch(errno){
		console.error(errno);
	}
}

