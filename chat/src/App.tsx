import {useState, useEffect} from 'react';
import VoiceChannel from './components/voice/VoiceChannel';
import '@livekit/components-styles';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This runs exactly once when the page loads
    const fetchToken = async () => {
      try {
        // Because your auth is already handled, your backend knows who is making this request via their session cookie
        let roomcode = 'general-chat';
        const response = await fetch('/api/join-voice', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({roomcode})
        });

        if (!response.ok) {
          throw new Error('Failed to authorize with Node backend');
        }

        const data = await response.json();
        setToken(data.token);
      } catch (err) {
        console.error("Token fetch failed:", err);
        setError("Could not connect to the server.");
      }
    };

    fetchToken();
  }, []);

  // State 1: The backend rejected them, or the Node server is down
  if (error) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <h2>{error}</h2>
      </div>
    );
  }

  // State 2: Waiting for the network request to finish
  if (!token) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <h2>Connecting to the grid...</h2>
      </div>
    );
  }

  // State 3: Token acquired. Mount the LiveKit room.
  return (
    <div className="app-layout">
      <VoiceChannel token={token} />
    </div>
  );
}
