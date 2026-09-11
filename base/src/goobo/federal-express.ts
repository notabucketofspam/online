import {
  MessageRow,
  GatewayGrade,
  GatewayItem,
  MessageCreate,
  WsEventData,
  WsFlavour
} from "./common-core";
import {gen_gmli} from './burger-parlour.js';

const refreshTime = 25e3;
let refreshTimer: number = 0;
let sock: WebSocket | null = null;
let shouldRecover = true;
let product_key: string | null = null;
let user_id: number | null = null;

export function setWsShouldRecover(should: boolean) {
	shouldRecover = should;
}

/**some real slop if i've ever seen it*/
export async function init_websocket() {
  try {
    // get an auth token
    const res = await fetch('/api/dmv/authn/please', {method: 'GET'});
    const json = await res.json();
    if (typeof json === 'object') {
      product_key = String(json?.product_key);
      user_id = Number(json?.user_id);
    }

		// open the websocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/michigan`;
    sock = new WebSocket(wsUrl);

    sock.addEventListener('open', ws_onopen);
    sock.addEventListener('message', ws_onmessage);
    sock.addEventListener('error', ws_onerror);
    sock.addEventListener('close', ws_onclose);
  } catch (err) {
    console.error(err);
  }
}

function ws_onclose(ev: CloseEvent) {
  let wsUrl = 'the place';
  let ws = ev.target as WebSocket | null;
  if (ws) {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
    }
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
  const ws = ev.target as WebSocket | null;
  if (ws) {
    ws.close();
  }
}
function ws_onmessage(ev: MessageEvent) {
  try {
    const ws = ev.target as WebSocket | null;
    const ev_data: WsEventData = JSON.parse(ev.data);
    const flavour: WsFlavour | undefined = ev_data?.flavour;
    if (typeof flavour === 'string') {
      if (flavour === 'gmail') {
        const gmail_item = ev_data as GatewayItem;
        handle_gmail(gmail_item);
      } else if (flavour === 'authn-ok') {
        console.log("authn-ok is PREEM");
        if (ws) {
          sendWsPing(ws);
          // send pings every so often
          refreshTimer = window.setInterval(() => {
            sendWsPing(ws);
          }, refreshTime);
        }
      } else {
        // invalid flavour; do nothing
      }
    }
  } catch (err) {
    console.error(`websocket parse error:`, err);
  }
}
function ws_onopen(ev: Event) {
  const ws = ev.target as WebSocket | null;
  if (ws) {
    console.log(`websocket attached to ${ws.url}`);
		ws.send(JSON.stringify({flavour: 'authn-ok', product_key, user_id}));
  }
}
const PingBuffer = Uint8Array.from([0x09]);
function sendWsPing(ws: WebSocket) {
  try {
    // send a ping frame
    ws.send(PingBuffer);
  } catch (err) {
    console.error(err);
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
