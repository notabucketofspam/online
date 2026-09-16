import { useState, useEffect } from 'react';
import { Room, type RoomEventCallbacks } from 'livekit-client';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';

interface VoiceChannelProps {
  token: string;
  eventVectors?: Partial<RoomEventCallbacks>;
}

export default function VoiceChannel({ token, eventVectors }: VoiceChannelProps) {
  const serverUrl = "wss://livekit.waluigi-servebeer.com";

  const [room] = useState(() => new Room());

  useEffect(() => {
    if (!eventVectors)
      return () => {};

    const entries = Object.entries(eventVectors) as [keyof RoomEventCallbacks, RoomEventCallbacks[keyof RoomEventCallbacks]][];

    // attach the event listeners
    for (const [eventName, callback] of entries) {
      if (callback) {
        room.on(eventName, callback);
      }
    }

    // Remove the listeners if the component unmounts
    return () => {
      for (const [eventName, callback] of entries) {
        if (callback) {
          room.off(eventName, callback);
        }
      }
    };
  }, [room, eventVectors]);

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      data-lk-theme="default"
      room={room}
      audio={true}
      video={true}
    >
      <div className="voice-container">
        <div className="conference-area">
          <VideoConference />
        </div>
      </div>
    </LiveKitRoom>
  );
}
