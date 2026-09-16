import { useState, useEffect } from 'react';
import VoiceChannel from './voice/VoiceChannel';
import '@livekit/components-styles';
import { type RoomEventCallbacks } from 'livekit-client';
interface WidgetMountOptions {
  roomcode: string;
  eventVectors?: Partial<RoomEventCallbacks>;
}
export default function LiveKitRoomComponent({ roomcode, eventVectors }: WidgetMountOptions) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // this network request shall re-run if the roomcode changes
  useEffect(() => {
    // If there is no room code yet, do nothing
    if (!roomcode) {
       setToken(null);
       return;
    }

    const fetchToken = async () => {
      try {
        // Use the roomcode parameter
        const response = await fetch('/api/livekit/join-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomcode }) 
        });

        if (!response.ok) {
          throw new Error('Failed to authorize with Node backend');
        }

        const data = await response.json();
        setToken(data.token);
        // Clear any previous errors if a new room succeeds
        setError(null); 
      } catch (err) {
        console.error("Token fetch failed:", err);
        setError("Could not connect to the server.");
      }
    };

    fetchToken();
  }, [roomcode]); 

  // UI State 1: No room code typed in yet
  if (!roomcode) {
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
        <h2>Connecting to {roomcode}...</h2>
      </div>
    );
  }

  // UI State 4: Token acquired. 
  return (
    <div className="app-layout">
      <VoiceChannel token={token} eventVectors={eventVectors} />
    </div>
  );
}
