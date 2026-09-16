// widget.tsx
import { createRoot } from 'react-dom/client';
import { Room } from 'livekit-client';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import "./index.css";

export function createLivekitWidget(
  containerId: string,
  room: Room,
  token: string,
  serverUrl: string
) {
  const container = document.getElementById(containerId);

  if (!container) {
    console.error(`Could not find container with ID: ${containerId}`);
    return null;
  }

  const root = createRoot(container);

  root.render(
    <LiveKitRoom
      room={room}
      token={token}
      serverUrl={serverUrl}
      data-lk-theme="default"
      connect={true}
    >
      <VideoConference />
    </LiveKitRoom>
  );

  return () => {
    root.unmount();
  };
}
