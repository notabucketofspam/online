import { createRoot } from 'react-dom/client';
import { type RoomEventCallbacks } from 'livekit-client';
import LiveKitRoomComponent from './LiveKitRoomComponent';
import './index.css'

export interface WidgetMountOptions {
  roomcode: string;
  eventVectors?: Partial<RoomEventCallbacks>;
}
/**this is the function that creates a little voice chat window*/
export function mountLiveKitWidget (containerId:string, options: WidgetMountOptions) {
  const container = document.getElementById(containerId);
  if (!container)
    throw new Error(`Could not find element #${containerId}`);

  const root = createRoot(container);

  // Initial render
  root.render(
    <LiveKitRoomComponent 
      roomcode={options.roomcode} 
      eventVectors={options.eventVectors}
    />
  );

  return {
    setRoomCode: (newRoomCode:string) => {
      root.render(
        <LiveKitRoomComponent 
          roomcode={newRoomCode} 
          eventVectors={options.eventVectors}
        />
      );
    },
    unmount: () => {
      root.unmount();
    }
  };
}
