import {
  MessageRow, 
  ChannelRow, 
  PseudoListener,
  GuildMemberRow,
  GuildRow,
  UserRow
} from './shared-types';

export function nCreateMessage(message: MessageRow, listeners: PseudoListener[]):HTMLElement {
  const messageDiv = document.createElement('div');
  for (const listener of listeners) {
    messageDiv.addEventListener(listener.type, listener.callback);
  }
	return messageDiv;
}

export function nCreateChannel(channel: ChannelRow, listeners: PseudoListener[]):HTMLElement {
  const div = document.createElement('div');
  div.className = 'channel-item';

  // This is the anchor we will use to find it later
  div.dataset.id = String(channel.id);

  // The Discord-style hash icon
  const hash = document.createElement('span');
  hash.className = 'channel-hash';
  hash.innerText = '#';

  const name = document.createElement('span');
  name.className = 'channel-name';
  name.innerText = channel.name;

  div.appendChild(hash);
  div.appendChild(name);

  // Wire up the click event
  for (const listener of listeners) {
    div.addEventListener(listener.type, listener.callback);
  }

  return div;
}

export function nCreateChatInput(listeners: PseudoListener[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'chat-input-container';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chat-input';
  input.placeholder = 'Type a message...';

	for (const listener of listeners) {
		input.addEventListener(listener.type, listener.callback);
	}

  container.appendChild(input);
  return container;
}

export function nCreateChatArea(): HTMLElement {
  const main = document.createElement('main');
  main.className = 'chat-area';

  main.innerHTML = `
    <div class="chat-header" id="current-channel-name"># general</div>
    <div class="chat-feed" id="chat-feed"></div>
    <div class="chat-input-container">
      <input type="text" id="chat-input" placeholder="Message #general..." />
    </div>
  `;

  return main;
}
export function nCreateSidebar(): HTMLElement {
  const aside = document.createElement('aside');
  aside.className = 'channel-sidebar';

  aside.innerHTML = `
    <div class="sidebar-header">
      <h2>Text Channels</h2>
      <button id="add-channel-btn" class="icon-btn">+</button>
    </div>
    <div class="channel-list" id="channel-list-container">
      <!-- Channel items will be injected here -->
    </div>
  `;

  return aside;
}

export function nCreateGuildModal(listeners: PseudoListener[]): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.className = 'creation-modal';

  dialog.innerHTML = `
    <form method="dialog">
      <h2>Create a New Guild</h2>
      <input type="text" id="guild-name-input" placeholder="Guild Name" required autocomplete="off" />
      <div class="modal-actions">
        <button type="button" id="cancel-btn">Cancel</button>
        <button type="submit" id="submit-btn">Create</button>
      </div>
    </form>
  `;

	for (const listener of listeners) {
		dialog.addEventListener(listener.type, listener.callback);
  }

  // 2. Handle Cancelation
  dialog.querySelector('#cancel-btn')?.addEventListener('click', () => {
    dialog.close();
  });

  return dialog;
}

export function nCreateButtonAddGuild(listeners: PseudoListener[]): HTMLElement {
  const addGuildBtn = document.createElement('button');
  addGuildBtn.innerText = '+ Add Guild';

  addGuildBtn.addEventListener('click', function() {
    const modal = nCreateGuildModal(listeners);
    document.body.appendChild(modal);
    modal.showModal();
  });
	return addGuildBtn;
}
