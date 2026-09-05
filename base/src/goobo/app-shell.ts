
import {
  nCreateChannel, 
  nCreateChatArea, 
  nCreateChatInput,
  nCreateGuildModal,
  nCreateSidebar,
  nCreateMessage,
  nCreateButtonAddGuild
} from './create';

import {Snowflake} from "./shared-types";

export function createAppShell(): HTMLElement {
  const appContainer = document.createElement('div');
  appContainer.className = 'app-layout';

  const serverList = document.createElement('nav');
  serverList.className = 'server-list';
  appContainer.appendChild(serverList);

  const sidebar = nCreateSidebar();
  appContainer.appendChild(sidebar);

	const chatArea = nCreateChatArea();
  appContainer.appendChild(chatArea);

  const chatInputContainer = nCreateChatInput([]);
  appContainer.appendChild(chatInputContainer);

	const addGuildBtn = nCreateButtonAddGuild([]);
  appContainer.appendChild(addGuildBtn);

	//======================== god this app is already a mess =========================

  return appContainer;
}
