export function createSidebar(): HTMLElement {
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
