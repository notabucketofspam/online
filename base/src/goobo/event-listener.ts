import {vSetActiveChannel} from './channel-controller';
import {nCreateMessage} from './create';
import {MessageRow} from './shared-types';

export async function channel_onclick(ev: PointerEvent) {
  const aChannelId = (ev.currentTarget as HTMLElement).dataset.id;
  if (aChannelId) {
    const channel_id = Number(aChannelId);

    // update the ui so that this channel is selected
    vSetActiveChannel(channel_id);

    const chatFeed = document.getElementById('chat-feed');
    if (chatFeed) {
      // clear whatever is on screen
      chatFeed.innerHTML = '<div class="loading-spinner">Loading...</div>';

      try {
        // fetch old messages
        const response = await fetch(`/api/dmv/message/list/${channel_id}`);
        if (response.ok) {
          const historicalMessages:{messages:MessageRow[]} = await response.json();

          const messages = historicalMessages.messages;
          if (Array.isArray(messages)) {
						chatFeed.innerHTML = '';
						for (const msg of messages) {
							const node = nCreateMessage(msg, []);
							chatFeed.appendChild(node);
            }
            chatFeed.scrollTop = chatFeed.scrollHeight;
          } else {
						// messages is not an array, handle the error
          }
        } else {
          // response was not ok
          throw new Error('Failed to load history');
        }
      } catch (err) {
        chatFeed.innerHTML = '<div class="error">Could not load messages.</div>';
        console.error(err);
      }
    } else{
      // no chat feed
    }
  } else {
    // channel id is missing
  }
}

export async function chatInput_onkeydown(ev: KeyboardEvent) {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault(); // Prevent accidental form submissions or newlines
    const input = ev.currentTarget as HTMLInputElement | null;
    if (input) {
      const text = input.value.trim();
      if (text.length > 0) {
        // we need to do the sending thing here
        // onSend(text);
        input.value = '';
      } else {
				// you cant send a null message, so do nothing
      }
    } else {
			// input element is missing
    }
  } else {
		// they were holding down the shift key
  }
}

export function guildModal_onsubmit(ev: SubmitEvent) {
  const dialog = ev.currentTarget as HTMLDialogElement | null;
  if (dialog) {
    const input = dialog.querySelector('#guild-name-input') as HTMLInputElement;
    // we also have to submit it somehow
		// onSubmit(input.value);
    dialog.close(); 
  }
}

export function guildModal_onclose(ev: CloseEvent) {
	const target = ev.currentTarget as HTMLDialogElement | null;
	if (target) {
    target.remove();
  }
}
