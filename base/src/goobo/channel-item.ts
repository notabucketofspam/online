import type { ChannelRow } from './shared-types';

export function createChannelItem(
  channel: ChannelRow, 
  onSelect: (channelId: string) => void
): HTMLElement {
  const div = document.createElement('div');
  div.className = 'channel-item';
  
  // This is the anchor we will use to find it later
  div.dataset.id = channel.id.toString(); 

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
  div.addEventListener('click', () => {
    onSelect(channel.id.toString());
  });

  return div;
}
