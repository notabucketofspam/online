import { useState, useEffect } from 'react';
import VoiceChannel from './components/voice/VoiceChannel';
import '@livekit/components-styles';

// 1. Define the "options" (props) this component expects to receive from the outside
interface LiveKitRoomProps {
  roomCode: string | null;
  onDisconnect?: () => void;
}

export default function LiveKitRoomComponent({ roomCode, onDisconnect }: LiveKitRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If there is no room code yet (like when the page first loads), do nothing.
    if (!roomCode) {
       setToken(null);
       return;
    }

    const fetchToken = async () => {
      try {
        // 2. Use the dynamically passed roomCode instead of the hardcoded 'general-chat'
        const response = await fetch('/api/livekit/join-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomcode: roomCode }) 
        });

        if (!response.ok) {
          throw new Error('Failed to authorize with Node backend');
        }

        const data = await response.json();
        setToken(data.token);
        setError(null); // Clear any previous errors if a new room succeeds
      } catch (err) {
        console.error("Token fetch failed:", err);
        setError("Could not connect to the server.");
      }
    };

    fetchToken();
  }, [roomCode]); // 3. The dependency array: Re-run this network request if the roomCode changes

  // UI State 1: No room code typed in yet
  if (!roomCode) {
     return (
       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <h2>Please enter a room code to join.</h2>
       </div>
     );
  }

  // UI State 2: Backend rejected them
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2>{error}</h2>
      </div>
    );
  }

  // UI State 3: Waiting for network request
  if (!token) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2>Connecting to {roomCode}...</h2>
      </div>
    );
  }

  // UI State 4: Token acquired. 
  return (
    <div className="app-layout">
      {/* If your VoiceChannel accepts an onDisconnect prop, pass it down here */}
      <VoiceChannel token={token} onDisconnect={onDisconnect} />
    </div>
  );
}
