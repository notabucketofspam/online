import { LiveKitRoom, VideoConference } from '@livekit/components-react';

// 1. Define the props to match what LiveKitRoomComponent is sending down
interface VoiceChannelProps {
  token: string;
  onDisconnect?: () => void;
}

export default function VoiceChannel({ token, onDisconnect }: VoiceChannelProps) {
  const serverUrl = "wss://livekit.waluigi-servebeer.com";

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      onDisconnected={onDisconnect}
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