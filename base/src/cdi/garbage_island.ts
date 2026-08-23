import path from "node:path";
import {generateMSProductKey} from "../product_key";
import {astext} from "../util_dump";

/**
 * this is the function that we use to generate an image with the EVGA FTW GTX 1080
 * @param prompt
 * @returns
 */
export async function generateTrash(prompt:object) {
	return await new Promise<Blob>(function(resolve, reject) {
		/**the blob that has the final image in it*/
		let resblob = new Blob([]);

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
					fetch(iurl).then(res=>res.blob()).then(blob=>{
						resblob = blob;
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
			if (resblob.size){
				// Ladies and gentlemen, we got him.
				resolve(resblob);
			} else {
				// we got nothing
				reject(resblob);
			}
		}

		// add all thos event listeners
		socket.addEventListener('open', socket_onOpen);
		socket.addEventListener('message', socket_onMessage);
		socket.addEventListener('error', socket_onError);
		socket.addEventListener('close', socket_onClose);
	});
}
