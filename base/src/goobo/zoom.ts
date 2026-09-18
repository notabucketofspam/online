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
let unmount: (() => void) | null = null;

function CALL_unmount() {
	if (typeof unmount === 'function') {
		unmount();
		unmount = null;
	}
}
function CALL_mount() {
	try {
		CALL_unmount();
		unmount = createLivekitWidget('the-freezer', room, livekit_token, LIVEKIT_URL);
	} catch (e) {}
}

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
		if (the_fridge && the_freezer) {
			if (mount) {
				let info = getMetallikInfo();
				if (info) {
					// we have metallik; thus, we are in voice chat
					const info_id = Number(info.roomcode);
					if (info_id !== channel_id) {
						// this is a different channel than the channel we're currently looking at
						CALL_mount();
					} else {
						// we are already looking at this channel, so do nothing
					}
				} else {
					// no metallik means that we arent in voice chat
					await doJoinVoice(channel_id);
					info = getMetallikInfo();
					CALL_mount();
				}
				// actually show it to the customer
				the_fridge.setAttribute('hidden', '');
				the_freezer.removeAttribute('hidden');
			} else {
				// this is dealing with teardown
				//CALL_unmount();
				the_freezer.setAttribute('hidden', '');
				the_fridge.removeAttribute('hidden');
			}
		} else {
			// no fridge and/or freezer
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
			cache: 'no-store',
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ roomcode })
		});
		const data = await response.json();
		livekit_token = data.token;

		await room.connect(LIVEKIT_URL, livekit_token);

		// actually use the microphone
		await room.localParticipant.setMicrophoneEnabled(true, {
			echoCancellation: true,
			noiseSuppression: true,
			voiceIsolation: true,
			autoGainControl: true
		});
	} catch (err) {
		console.error('Error joining voice channel:', err);
	}
}

export async function leaveVoiceChannel(unmount=true) {
	try {
		await room.disconnect();
		if (unmount) {
			CALL_unmount();
		}
	} catch (err) {
		console.error(err);
	}
}

// some event listeners for the room

room.on(RoomEvent.Connected, async function () {
	// write down some info, in case we navigate away
	let roomsid = await room.getSid();
	let roomcode = room.name;
	writeMetallik({ roomcode, roomsid });
	mediaplayer.beep(livekitSound.join);
});

room.on(RoomEvent.Disconnected, function () {
	CALL_unmount();
	livekit_token = '';
	removeMetallik();
	mediaplayer.beep(livekitSound.disconnect);
});

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
