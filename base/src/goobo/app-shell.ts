import {createChatInput} from './chat-input';
import {createGuildModal} from './guild-modal';
import {createSidebar} from './sidebar';
import {createChatArea} from './chat-area';
import {createChannelItem} from './channel-item';
import {setActiveChannelUI} from './channel-controller';
import {Snowflake} from "./shared-types";

export function createAppShell(): HTMLElement {
  const appContainer = document.createElement('div');
  appContainer.className = 'app-layout';

  const serverList = document.createElement('nav');
  serverList.className = 'server-list';

  // Assemble the UI tree
  appContainer.appendChild(serverList);
  const sidebar = createSidebar();
  appContainer.appendChild(sidebar);
	const chatArea = createChatArea();
  appContainer.appendChild(chatArea);

	// ================ Wiring up the UI =====================

  const chatInputContainer = createChatInput((text) => {
    console.log(`Ready to send to WebSocket: ${text}`);
    // ws.send(JSON.stringify({ type: 'MESSAGE_CREATE', ... }))
  });

  // 2. Wire up a "New Guild" button in the sidebar
  const addGuildBtn = document.createElement('button');
  addGuildBtn.innerText = '+ Add Guild';
  addGuildBtn.addEventListener('click', () => {

    // Instantiate the modal, attach it to the root, and natively show it
    const modal = createGuildModal((guildName) => {
      console.log(`Ready to POST new guild to server: ${guildName}`);
    });

    document.body.appendChild(modal);
    modal.showModal();
  });

  appContainer.appendChild(addGuildBtn);
  appContainer.appendChild(chatInputContainer);

	// ============= some more ai slop, i guess =====================

  // Pretend we fetched these from Oracle on load
  const mockChannels = [
    {id: 1, name: 'general', guild_id: 1, channel_type: 'text', created_at: Date.now()},
    {id: 2, name: 'development', guild_id: 1, channel_type: 'text', created_at: Date.now()}
  ];

  mockChannels.forEach(channelData => {
    const channelNode = createChannelItem(channelData, (clickedId) => {

      // 1. Update the UI visually
      setActiveChannelUI(clickedId);

      // 2. Tell the WebSocket to subscribe to the new channel's message history
      console.log(`Subscribing to channel: ${clickedId}`);

    });

    const channelListContainer = sidebar.querySelector('#channel-list-container');
    if (channelListContainer) {
      channelListContainer.appendChild(channelNode);
    }
  });

	//======================== god this app is already a mess =========================

  return appContainer;
}
