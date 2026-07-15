import {Room, RoomEvent, Track, createLocalAudioTrack} from 'https://esm.sh/livekit-client';

var LIVEKIT_URL = 'wss://livekit.waluigi-servebeer.com';
/**@type{Room} */
var room = new Room();
var audioContext = new AudioContext();
var livekit = { 
  room, 
  joinVoiceChannel,
	audioContext,
  init() {
  },
  sound: {
    join: 'MLG/Discord%20join%20voice%20chat',
    leave: 'MLG/Discord%20leave%20voice%20chat',
    disconnect: 'MLG/Discord%20disconnect%20voice%20chat',
  }
};
window.livekit = livekit;
// livekit.init();

room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
  checkParticipantsSpeaking();
});

function updateParticipantList() {
  try {
    const listContainer = document.getElementById('participant-list');
    // listContainer.innerHTML = '';

    // It's you.
    if (room.localParticipant) {
			let metallik = document.getElementById('livekit_roomcode');
      if (metallik) {
        createLocalParticipantDOM();
      }
    } else {
			console.log("No local participant found.");
    }

    // we gotta check in case someone has joined
    room.remoteParticipants.forEach((participant) => {
			let existingLi = document.getElementById(`user-${participant.identity}`);
      if (existingLi) {
        // already on the page
        return;
      } else {
        // !!! NEW !!!
				const friendLi = createParticipantDOM(participant);
				listContainer.appendChild(friendLi);
      }
	  }); // forEach

		// also check in case someone has left
		const participantIds = new Set();
		room.remoteParticipants.forEach((participant) => {
      participantIds.add(participant.identity);
    });
		participantIds.add(room.localParticipant?.identity);
		Array.from(document.getElementById('participant-list').children).forEach((li) => {
			const participantId = li.id.replace('user-', '');
			if (!participantIds.has(participantId)) {
				li.remove();
			}
		});

	} catch (err) {
		console.error('Error updating participant list:', err);
  }
}

function createLocalParticipantDOM() {
  try {
		let listContainer = document.getElementById('participant-list');
    if (listContainer && room.localParticipant) {
			const useThisID = `user-${room.localParticipant.identity}`;
			if (document.getElementById(useThisID)) {
        // it's already in the DOM, so we can skip :^)
        console.log("OK");
      } else {
        // you're not real
        // console.log("ADDING YOU TO THE PAGE NOW");
        const meLi = document.createElement('li');
        meLi.id = useThisID;
        meLi.innerHTML = `<span>${room.localParticipant.name}</span>`;
				// console.log("meLi:", meLi);
        setTimeout(() => {
          listContainer.appendChild(meLi);
        });
      }
    } else {
      // where are you right now?
      console.log("wha?");
    }
	} catch (err) {
		console.error('Error creating local participant DOM:', err);
  }
}

function createParticipantDOM(participant) {
  try {
    // create the list item
    const friendLi = document.createElement('li');
    friendLi.id = `user-${participant.identity}`;
	  friendLi.classList.add('participant-item');
    friendLi.innerHTML = 
      `<span id="name-${participant.identity}">${participant.name || participant.identity}</span>`;

	  //create the slider and set its attributes
	  const slider = document.createElement('input');
	  slider.type = 'range';
    slider.id = `volume-${participant.identity}`;
	  slider.setAttribute('min', '0');
    slider.setAttribute('max', '1');
	  slider.setAttribute('step', 'any');
	  slider.setAttribute('value', '0.5');
	  slider.style.verticalAlign = 'middle';
	  slider.style.marginLeft = '10px';
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

	  friendLi.appendChild(slider);

	  return friendLi;
  } catch(err) {
		console.error('Error creating participant DOM:', err);
  }
}

function clearParticipantList() {
	let participantList = document.getElementById('participant-list');
	if (participantList) {
		participantList.innerHTML = '';
  }
}

function checkParticipantsSpeaking(){
	try {
    // check yourself
		if (room.localParticipant.isSpeaking) {
			document.getElementById(`user-${room.localParticipant.identity}`)?.classList.add('isSpeaking');
		} else {
			document.getElementById(`user-${room.localParticipant.identity}`)?.classList.remove('isSpeaking');
    }

    // check the others
		room.remoteParticipants.forEach((participant) => {
			if (participant.isSpeaking) {
				document.getElementById(`user-${participant.identity}`)?.classList.add('isSpeaking');
			} else {
				document.getElementById(`user-${participant.identity}`)?.classList.remove('isSpeaking');
      }
		});
	} catch (err) {
		console.error('Error checking participants speaking:', err);
  }
}

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

    await room.connect(LIVEKIT_URL, token);
    // console.log('Successfully connected to the room!');

		// actually use the microphone
    await room.localParticipant.setMicrophoneEnabled(true, {
			echoCancellation: true,
			noiseSuppression: true,
      voiceIsolation: true,
			autoGainControl: true
    });

		displayView(roomcode);

		var metallik = document.createElement('meta');
		metallik.setAttribute('id', 'livekit_roomcode');
		metallik.setAttribute('data-roomcode', roomcode);
		metallik.setAttribute('data-roomsid', room?.roomInfo?.sid);
		document.head.appendChild(metallik);

    updateParticipantList();
    // setTimeout(loadActiveRooms, 100);

		window.MediaPlayer?.beep(livekit.sound.join);
  } catch (err) {
		console.error('Error joining voice channel:', err);
  }
}

function handleJoinBtnClick(ev) {
  const roomcode = document.getElementById('roomcode-input').value ?? 'general-chat';
  joinVoiceChannel(roomcode);
}

window.joinVoiceChannel = joinVoiceChannel;

async function leaveVoiceChannel() {
  try {
    await room.disconnect();
    document.getElementById('audio-container').innerHTML = '';
		displayView(null);

		var metallik = document.getElementById('livekit_roomcode');
		if (metallik) {
			metallik.remove();
		}

    // console.log('Disconnected from the room.');
    window.MediaPlayer?.beep(livekit.sound.disconnect);

		clearParticipantList();

    // refresh listings
		setTimeout(loadActiveRooms, 100);
	} catch (err) {
    console.error(err);
  }
}

/**
 * 
 * @param {string|null} roomcode
 */
function displayView(roomcode){
  try {
    if (typeof roomcode === 'string' && roomcode.length > 0) {
      // roomcode is ok

      var lobbyview = document.getElementById('lobby-view');
      if (lobbyview){
        lobbyview.style.display = 'none';
      }

      var activecallview = document.getElementById('active-call-view');
      if (activecallview){
        activecallview.style.display = 'block';
      }

      var currentroomtitle = document.getElementById('current-room-title');
      if (currentroomtitle) {
        currentroomtitle.innerText = `Connected to: ${roomcode}`;
      }
    } else {
      // null was passed, so we assume we're not in a room

      var lobbyview = document.getElementById('lobby-view');
      if (lobbyview){
        lobbyview.style.display = 'block';
      }

      var activecallview = document.getElementById('active-call-view');
      if (activecallview){
        activecallview.style.display = 'none';
      }
    }
  } catch(err){}
}

async function loadActiveRooms() {
  if (window.location.hostname === 'localhost') {
    return;
  }
  try {
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
        <button onclick="joinVoiceChannel('${room.name}')"
        id="${room.sid}"
        >Join</button>
      `;
      container.appendChild(roomDiv);
    });
	  checkRoomIDs();
  } catch(err) {
		console.error('Error loading active rooms:', err);
  }
}

function checkRoomIDs(){
  try {
    // try to figure out the room sid
    let metallik = document.getElementById('livekit_roomcode');
    if (!metallik) return;

    let currentRoomSid = metallik.getAttribute('data-roomsid');
    if (!currentRoomSid) return;
  
		let theRelevantButton = document.getElementById(currentRoomSid);
		if (!theRelevantButton) return;
    // if we have it, then disable it
		theRelevantButton.setAttribute('disabled', 'true');
  }catch(err){
		console.error('Error checking room IDs:', err);
  }
}

async function init_livekit_dom() {
  if (window.location.hostname !== 'localhost') {
    loadActiveRooms();
  }

	// add event listeners for buttons
	var loadactiveroomsbtn = document.getElementById('loadactiverooms');
	if (loadactiveroomsbtn) {
		loadactiveroomsbtn.addEventListener('click', loadActiveRooms);
  }

	var leave_btn = document.getElementById('leave-btn');
	if (leave_btn) {
		leave_btn.addEventListener('click', leaveVoiceChannel);
  }

	var join_btn = document.getElementById('join-btn');
	if (join_btn) {
		join_btn.addEventListener('click', handleJoinBtnClick);
	}

	// load the correct view, if we're already in a room
	var metallik = document.getElementById('livekit_roomcode');
	if (metallik) {
		var roomcode = metallik.getAttribute('data-roomcode');
		if (roomcode) {
			displayView(roomcode);
    }
  }

	updateParticipantList();
}
window.init_livekit_dom = init_livekit_dom;

