import {Room, RoomEvent, Track} from 'https://esm.sh/livekit-client';

var LIVEKIT_URL = 'wss://livekit.waluigi-servebeer.com';
/**@type{Room} */
var room = undefined;
window.livekit = { 
  room, 
  joinVoiceChannel,
  init() {
    room = new Room();
  },
  sound: {
    join: 'MLG/Discord%20join%20voice%20chat',
    leave: 'MLG/Discord%20leave%20voice%20chat',
    disconnect: 'MLG/Discord%20disconnect%20voice%20chat',
  }
};
livekit.init();

function updateParticipantList() {
  try {
    const listContainer = document.getElementById('participant-list');
    listContainer.innerHTML = '';

    // 1. Always add yourself to the top of the list
    if (room.localParticipant) {
      const meLi = document.createElement('li');
      // Using the 'name' field sent by your Node backend
      meLi.innerHTML = `<strong>${room.localParticipant.name} (You)</strong>`;
      listContainer.appendChild(meLi);
    }

    // 2. Loop through every other active friend in the room
    room.remoteParticipants.forEach((participant) => {
      const friendLi = document.createElement('li');
      friendLi.id = `user-${participant.identity}`;

      const sliderId = `volume-${participant.identity}`;
          friendLi.innerHTML = `
        <span>${participant.name || participant.identity}</span>
        <input type="range" id="${sliderId}" 
          min="0" max="1" step="any" value="0.5"
          style="vertical-align: middle; margin-left: 10px;"
        >`;
      listContainer.appendChild(friendLi);

      const slider = document.getElementById(sliderId);
      slider.addEventListener('input', (event) => {
        const volumeLevel = parseFloat(event.target.value);
        // Loop through all tracks this specific person is publishing
        participant.trackPublications.forEach((publication) => {
          // If it's an active audio track, adjust its local playback volume
          if (publication.track && publication.kind === 'audio') {
            publication.track.setVolume(volumeLevel);
          }
        }); //forEach
		  }); // addEventListener

	  }); // forEach
	} catch (err) {
		console.error('Error updating participant list:', err);
  }
}

/**
 * 
 * @param {string} roomcode
 */
async function joinVoiceChannel(roomcode) {
  try {
		if (!roomcode) {
			roomcode = 'general-chat';
    }
    const response = await fetch('/api/join-voice', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({roomcode})
    });
    const data = await response.json();
    const token = data.token;
    // console.log(token);

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        // console.log(`Receiving audio from ${participant.identity}`);
        const audioElement = track.attach();
        document.getElementById('audio-container').appendChild(audioElement);

        const slider = document.getElementById(`volume-${participant.identity}`);
        if (slider) {
          track.setVolume(parseFloat(slider.value));
        }
      }
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      // console.log(`${participant.name} joined`);
      updateParticipantList();
			window.MediaPlayer?.beep(livekit.sound.join);
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      // console.log(`${participant.name} left`);
      updateParticipantList();
			window.MediaPlayer?.beep(livekit.sound.leave);
    });

    await room.connect(LIVEKIT_URL, token);
    // console.log('Successfully connected to the room!');
    await room.localParticipant.setMicrophoneEnabled(true);

    document.getElementById('lobby-view').style.display = 'none';
    document.getElementById('active-call-view').style.display = 'block';
    document.getElementById('current-room-title').innerText = `Connected to: ${roomcode}`;

    updateParticipantList();
		window.MediaPlayer?.beep(livekit.sound.join);
  } catch (err) {
		console.error('Error joining voice channel:', err);
  }
}

document.getElementById('join-btn').addEventListener('click', () => {
  const roomcode = document.getElementById('roomcode-input').value ?? 'general-chat';
  joinVoiceChannel(roomcode);
});

window.joinVoiceChannel = joinVoiceChannel;

async function leaveVoiceChannel() {
  try {
    await room.disconnect();
    document.getElementById('audio-container').innerHTML = '';
    document.getElementById('active-call-view').style.display = 'none';
    document.getElementById('lobby-view').style.display = 'block';

    // console.log('Disconnected from the room.');
    window.MediaPlayer?.beep(livekit.sound.disconnect);
	} catch (err) {
    console.error(err);
  }
}

document.getElementById('leave-btn').addEventListener('click', leaveVoiceChannel);

async function loadActiveRooms() {
  const response = await fetch('/api/active-rooms',{
		method: 'GET',
		cache: 'no-store',
  });
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

