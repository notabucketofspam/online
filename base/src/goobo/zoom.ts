
import { mountLiveKitWidget, WidgetMountOptions } from "chat";
//@ts-ignore
//import { mountLiveKitWidget, WidgetMountOptions } from "/chat/livekit-widget.js";

import MediaPlayer from "./extern/MediaPlayer";

const mediaplayer = new MediaPlayer();

const livekitSound = {
	join: '/page/soundboard/opodes/MLG/Discord%20join%20voice%20chat.opus',
	leave: '/page/soundboard/opodes/MLG/Discord%20leave%20voice%20chat.opus',
	disconnect: '/page/soundboard/opodes/MLG/Discord%20disconnect%20voice%20chat.opus'
};

export function mountZoomWidget(containerId: string, options: WidgetMountOptions) {
	try {
		const container = document.getElementById(containerId);
		if (container && typeof options?.roomcode === "string") {
			// const rval = mountLiveKitWidget(containerId, options);
		} else {
			console.error('missing things');
		}
	} catch (error) {
		console.error("Error mounting Zoom widget:", error);
	}
}

export function getInChat(force:boolean=false) {
	try {
		const metallik = document.getElementById('livekit_roomcode') as HTMLMetaElement | null;
		if (metallik) {
			// we are already in a livekit room, so we can just mount the widget
		} else {
			// we are not in a call at the moment
		}
	} catch (err) {
		console.error(err);
	}
}

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
