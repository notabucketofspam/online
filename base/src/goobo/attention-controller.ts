export function vSetActiveChannel(channel_id: number) {
  // deactivate the current active channel
  const currentActive = document.querySelector('.channel-item.active');
  if (currentActive) {
    currentActive.classList.remove('active');
  }

  // activate the almonds
  const newActive = document.querySelector(`.channel-item[data-id="${channel_id}"]`);
  if (newActive) {
    newActive.classList.add('active');    
    // clear the unread badge 
    newActive.classList.remove('has-unread');
  }

  // update the chat feed
  const chatFeed = document.getElementById('chat-feed');
  if (chatFeed) {
    chatFeed.dataset.activeChannel = String(channel_id);
  }
}
