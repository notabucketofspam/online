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
