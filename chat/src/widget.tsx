// widget.tsx (Your new entry point)
import { createRoot } from 'react-dom/client';
import './index.css'
import LiveKitRoomComponent from './LiveKitRoomComponent'; // Your LiveKit code

// Attach to window so the non-React app can access it
export const mountLiveKitWidget = (containerId:string, options:{roomCode:string, onDisconnect:() => void}) => {
  const container = document.getElementById(containerId);
  if (!container) throw new Error(`Could not find element #${containerId}`);

  const root = createRoot(container);

  // Initial render
  root.render(
    <LiveKitRoomComponent 
      roomCode={options.roomCode} 
      onDisconnect={options.onDisconnect} 
    />
  );

  // Return an object that lets vanilla JS update the React component later
  return {
    setRoomCode: (newRoomCode:string) => {
      // Re-rendering the root with new props is the standard React 18 way 
      // to update from the outside. React is smart enough to only update the DOM that changed.
      root.render(
        <LiveKitRoomComponent 
          roomCode={newRoomCode} 
          onDisconnect={options.onDisconnect} 
        />
      );
    },
    unmount: () => {
      root.unmount();
    }
  };
};
