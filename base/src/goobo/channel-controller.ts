export function setActiveChannelUI(channelId: string) {
  // 1. Find the currently active channel and strip the class
  const currentActive = document.querySelector('.channel-item.active');
  if (currentActive) {
    currentActive.classList.remove('active');
  }

  // 2. Find the newly clicked channel using the dataset ID
  const newActive = document.querySelector(`.channel-item[data-id="${channelId}"]`);
  if (newActive) {
    newActive.classList.add('active');
    
    // 3. Clear the unread badge since they are looking at it now
    newActive.classList.remove('has-unread');
  }

  // 4. Update the chat feed's dataset so your WebSocket router 
  // knows which channel the user is currently viewing!
  const chatFeed = document.getElementById('chat-feed');
  if (chatFeed) {
    chatFeed.dataset.activeChannel = channelId;
  }
}
