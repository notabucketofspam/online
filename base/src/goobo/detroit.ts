export function createSidebar(): HTMLElement {
  const aside = document.createElement('aside');
  aside.className = 'sidebar';
  
  aside.innerHTML = `
    <div class="channel-header">Text Channels</div>
    <div class="channel-list" id="channel-list"></div>
  `;
  
  return aside;
}

export function createChatArea(): HTMLElement {
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

export function createAppShell(): HTMLElement {
  const appContainer = document.createElement('div');
  appContainer.className = 'app-layout';

  const serverList = document.createElement('nav');
  serverList.className = 'server-list';

  // Assemble the UI tree
  appContainer.appendChild(serverList);
  appContainer.appendChild(createSidebar());
  appContainer.appendChild(createChatArea());

  return appContainer;
}

function spawn_goobo() {
  const goobo_root = document.getElementById('goobo-root');
  if (goobo_root) {
    goobo_root.innerHTML = '';
    goobo_root.appendChild(createAppShell());
  }
}

document.addEventListener('spam', ev => {
	let cev = ev as CustomEvent;
	let the_url = cev?.detail?.url;
	if (typeof the_url === 'string' && the_url.startsWith('/api/goobo')) {
    spawn_goobo();
  }
});
spawn_goobo();
