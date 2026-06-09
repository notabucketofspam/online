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
    console.log(token);

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

async function leaveVoiceChannel() {
  try {
    await room.disconnect();
    document.getElementById('audio-container').innerHTML = '';
    console.log('Disconnected from the room.');
	} catch (err) { }
  const room = lk_sauce.room;
}

document.getElementById('leave-btn').addEventListener('click', leaveVoiceChannel);

async function loadActiveRooms() {
  const response = await fetch('/api/active-rooms');
  const activeRooms = await response.json();

  const container = document.getElementById('room-list-container');
  container.innerHTML = ''; // Clear the old list

  if (activeRooms.length === 0) {
    container.innerHTML = '<p>No one is online right now.</p>';
    return;
  }

	typeof activeRooms.forEach === 'function' &&
  activeRooms.forEach(room => {
    const roomDiv = document.createElement('div');
    roomDiv.className = 'room-card';
    roomDiv.innerHTML = `
      <strong>${room.name}</strong> 
      <span>(${room.participantCount} online)</span>
      <button onclick="joinVoiceChannel('${room.name}')">Join</button>
    `;
    container.appendChild(roomDiv);
  });
}

// Call this when the page loads, or put it on a setInterval to auto-refresh
loadActiveRooms();
document.getElementById('loadactiverooms').addEventListener('click', loadActiveRooms);

lk_init();
