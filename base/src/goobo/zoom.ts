import {
	Room,
	RoomEvent,
	Track,
	createLocalAudioTrack,
	Participant,
	type AudioTrack,
} from "livekit-client";

import { createLivekitWidget } from "chat";
import MediaPlayer from "MediaPlayer";

const livekitSound = {
	join: '/page/soundboard/opodes/MLG/Discord%20join%20voice%20chat.opus',
	leave: '/page/soundboard/opodes/MLG/Discord%20leave%20voice%20chat.opus',
	disconnect: '/page/soundboard/opodes/MLG/Discord%20disconnect%20voice%20chat.opus'
};
const LIVEKIT_URL = "wss://livekit.waluigi-servebeer.com";

const room = new Room();
const mediaplayer = new MediaPlayer();
let livekit_token: string = '';
let unmountTheWidget: (() => void) | null = null;

/**We call this inside of "setActiveChannel", within arbor-day.ts */
export async function doJoinVoice(channel_id: number) {
	try {
		const roomcode = String(channel_id);
		await joinVoiceChannel(roomcode);
	} catch (er) {
		console.error(er);
	}
}

/** we have already joined voice chat, we just gotta render it now*/
export async function renderVoice(channel_id: number, mount:boolean = true) {
	try {
		const the_fridge = document.getElementById('the-fridge') as HTMLUListElement | null;
		const the_freezer = document.getElementById('the-freezer') as HTMLDivElement | null;
		const info = getMetallikInfo();
		if (the_fridge && the_freezer && info) {
			if (mount) {
				const now_active = document.querySelector('li.goobo-channel.active') as HTMLLIElement | null;
				/**the id for the current channel*/
				const now_cid = Number(now_active?.getAttribute('data-channel-id'));
				if (now_cid !== channel_id) {
					// this is a different channel than the channel we're currently looking at
					if (typeof unmountTheWidget === 'function') {
						unmountTheWidget();
						unmountTheWidget = null;
					}
					unmountTheWidget = createLivekitWidget('the-freezer', room, livekit_token, LIVEKIT_URL);
				} else {
					// we are already looking at this channel
				}
				// actually show it to the customer
				the_fridge.setAttribute('hidden', '');
				the_freezer.removeAttribute('hidden');
			} else {
				// this is dealing with teardown
				if (typeof unmountTheWidget === 'function') {
					unmountTheWidget();
					unmountTheWidget = null;
				}
				the_freezer.setAttribute('hidden', '');
				the_fridge.removeAttribute('hidden');
			}
		} else {
			// no fridge and/or freezer, or maybe no metallik info
		}
	} catch (errrrr) {
		console.error(errrrr);
	}
}

// this is how we actually join / leave voice chat

async function joinVoiceChannel(roomcode: string) {
	try {
		if (!roomcode) {
			roomcode = 'general-chat';
		}
		const response = await fetch('/api/livekit/join-voice', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ roomcode })
		});
		const data = await response.json();
		livekit_token = data.token;

		await room.connect(LIVEKIT_URL, livekit_token);

		// write down some info, in case we navigate away
		let roomsid = await room.getSid();
		writeMetallik({ roomcode, roomsid });

		// actually use the microphone
		await room.localParticipant.setMicrophoneEnabled(true, {
			echoCancellation: true,
			noiseSuppression: true,
			voiceIsolation: true,
			autoGainControl: true
		});

		mediaplayer.beep(livekitSound.join);
	} catch (err) {
		console.error('Error joining voice channel:', err);
	}
}

async function leaveVoiceChannel() {
	try {
		await room.disconnect();
		livekit_token = '';

		removeMetallik();

		mediaplayer.beep(livekitSound.disconnect);
	} catch (err) {
		console.error(err);
	}
}

// some event listeners for the room

room.on(RoomEvent.ParticipantConnected, function(participant) {
	mediaplayer.beep(livekitSound.join);
});

room.on(RoomEvent.ParticipantDisconnected, function(participant) {
	mediaplayer.beep(livekitSound.leave);
});

// this is all a bunch of metadata about our room

type MetallikInfo = {
	roomcode: string;
	roomsid: string;
};

function getMetallikInfo(): MetallikInfo | null {
	let info: MetallikInfo | null = null;
	const metallik = document.getElementById('livekit_roomcode') as HTMLMetaElement | null;
	if (metallik) {
		const roomcode = metallik.getAttribute('data-roomcode');
		const roomsid = metallik.getAttribute('data-roomsid');
		if (roomcode && roomsid) {
			info = { roomcode, roomsid };
		}
	}
	return info;
}

function writeMetallik(info: MetallikInfo) {
	let metallik = document.getElementById('livekit_roomcode') as HTMLMetaElement | null;
	if (metallik) {
		metallik.setAttribute('data-roomcode', info.roomcode);
		metallik.setAttribute('data-roomsid', info.roomsid);
	} else {
		metallik = document.createElement('meta');
		metallik.id = 'livekit_roomcode';
		metallik.setAttribute('data-roomcode', info.roomcode);
		metallik.setAttribute('data-roomsid', info.roomsid);
		document.head.appendChild(metallik);
	}
	return metallik;
}

function removeMetallik() {
	const metallik = document.getElementById('livekit_roomcode') as HTMLMetaElement | null;
	if (metallik){
		metallik.remove();
	}
}
