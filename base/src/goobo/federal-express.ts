import {
  MessageRow,
  GatewayGrade,
  GatewayItem,
  MessageCreate
} from "./common-core";
import {gen_gmli} from './burger-parlour.js';

let ws: WebSocket | null = null;
let shouldRecover = true;

export function setWsShouldRecover(should: boolean) {
	shouldRecover = should;
}

/**some real slop if i've ever seen it*/
export function init_websocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/michigan`;

  ws = new WebSocket(wsUrl);

  ws.addEventListener('open', ws_onopen);
  ws.addEventListener('message', ws_onmessage);
  ws.addEventListener('error', ws_onerror);
  ws.addEventListener('close', ws_onclose);
}

function ws_onclose(ev: CloseEvent) {
	let wsUrl = 'the place';
  if (ws) {
		wsUrl = ws.url;
    ws.removeEventListener('error', ws_onerror);
    ws.removeEventListener('open', ws_onopen);
		ws.removeEventListener('message', ws_onmessage);
		ws.removeEventListener('close', ws_onclose);
  }
  ws = null;
  if (shouldRecover) {
    console.log(`retrying websocket connection to ${wsUrl}`);
		setTimeout(init_websocket, 5000);
  }
}
function ws_onerror(ev: Event) {
  console.error(ev);
  if (ws) {
    ws.close();
  }
}
function ws_onmessage(ev: MessageEvent) {
  try {
    const item = JSON.parse(ev.data);
    handle_gmail(item);
  } catch (err) {
    console.error(`websocket parse error:`, err);
  }
}
function ws_onopen(ev: Event) {
  if (ws) {
    console.log(`websocket attached to ${ws.url}`);
  }
}

/**Gmail means "Gateway Mail", *not* "Google Email"*/
function handle_gmail(item: GatewayItem) {
  const paygrade = item.grade;
  if (typeof paygrade !== 'string') {
    // we are gonna ignore it
  } else if (paygrade === 'M_CREATE') {
		const item_mc = item as MessageCreate;
    // ~~ we just got a letter ~~
    const channel_id = Number(item_mc?.channel_id);
    const message_row: MessageRow | undefined = item_mc?.message_row;

    const relevant_channel = document.querySelector(`li.goobo-channel[data-channel-id="${channel_id}"]`);
    if (relevant_channel) {
      if (relevant_channel.classList.contains('active')) {
        // the user is looking right here
        const message_li = gen_gmli(message_row);
        const fridge = document.getElementById('the-fridge');
        if (fridge) {
          fridge.appendChild(message_li);
        } else {
          // paste it onto the bottom of the html doc.
          // i honestly dont care what you do with it at this point.
          document.body.appendChild(message_li);
        }
      } else {
        // add an "unread message badge" to the channel li
				relevant_channel.classList.add('unread');
      }
    } else {
      // we dont care about this channel (mail probably went to the wrong house)
    }
  } else {
    // i havent implemented any other stats yet lol
  }
}
