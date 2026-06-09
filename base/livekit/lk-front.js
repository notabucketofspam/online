import {Room, RoomEvent, Track} from 'https://esm.sh/livekit-client';

var LIVEKIT_URL = 'wss://livekit.waluigi-servebeer.com';
var lk_sauce = {
  room: undefined
}
function lk_init() {
  const room = new Room();
	lk_sauce.room = room;
}

/**
 * 
 * @param {string} roomcode
 */
async function joinVoiceChannel(roomcode) {
  try {
    const response = await fetch('/api/join-voice', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({roomcode})
    });
    const data = await response.json();
    const token = data.token;

    const room = lk_sauce.room;
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        console.log(`Receiving audio from ${participant.identity}`);
        const audioElement = track.attach();
        document.getElementById('audio-container').appendChild(audioElement);
      }
    });

    await room.connect(LIVEKIT_URL, token);
    console.log('Successfully connected to the room!');

    await room.localParticipant.setMicrophoneEnabled(true);

  } catch (err) {
		console.error('Error joining voice channel:', err);
  }
}

document.getElementById('join-btn').addEventListener('click', () => {
  const roomcode = document.getElementById('roomcode-input').value ?? 'general-chat';
  joinVoiceChannel(roomcode);
});

lk_init();
