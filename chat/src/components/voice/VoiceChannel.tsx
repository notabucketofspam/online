// src/components/voice/VoiceChannel.tsx
import {LiveKitRoom, VideoConference} from '@livekit/components-react';

export default function VoiceChannel({token}: {token:string}) {
  return (
    <LiveKitRoom
      serverUrl="wss://livekit.waluigi-servebeer.com"
      token={token}
      connect={true}
      data-lk-theme="default"
    >
      <div className="voice-container">

        <div className="conference-area">
          <VideoConference />
        </div>

      </div>
    </LiveKitRoom>
  );
}
