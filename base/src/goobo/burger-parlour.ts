import {MessageRow} from "./common-core";

export function init_chatinput(){
	try {
		const vegan_whopper = document.getElementById("the-impossible-whopper");
		if (vegan_whopper instanceof HTMLInputElement) {
			vegan_whopper.addEventListener('keydown', chatinput_onkeydown);
		} else {/*couldn't find the input element*/ }
	} catch (err) {
		console.error(err);
	}
}

async function chatinput_onkeydown(ev: KeyboardEvent) {
	// console.log(ev);
	if (ev.key === 'Enter' && !ev.shiftKey) {
		ev.preventDefault();
		const input = ev.currentTarget as HTMLInputElement | null;
		const active_channel = document.querySelector('.goobo-channel.active') as HTMLLIElement | null;
		if (input && active_channel
			&& active_channel.dataset.channelId 
			&& active_channel.dataset.channelType === 'text') {
			const text = input.value.trim();
			if (text.length > 0) {
				// we need to do the sending thing here
				const was_ok = await sendMessage(Number(active_channel.dataset.channelId), text);
				if (was_ok) {
					input.value = '';
				} else {
					// handle the error if needed
				}
			} else {/*you cant send a null message, so do nothing*/}
		} else {/*input element is missing*/}
	} else {/*they were holding down the shift key*/}
}

async function sendMessage(channel_id: number, message_content: string) {
	let is_ok = false;
	try {
		const response = await fetch('/api/dmv/message/create', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ channel_id, message_content })
		});
		if (response.ok) {
			// it was fine, so we are ok
			is_ok = true;
		} else {
			// looks like we have a problem
			console.error('Failed to send message');
		}
	} catch (err) {
		console.error(err);
	}
	return is_ok;
}

export async function populate_fridge(channel_id: number, clearall: boolean = false){
	try {
		const the_fridge = document.getElementById('the-fridge') as HTMLUListElement | null;
		if (the_fridge) {
			// wipe it clean if we have to
			let query_params = '';
			if (clearall) {
				the_fridge.innerHTML = '';
			} else {
				// we are appending stuff to the bottom because the user scrolled down.
				// this requires the last message_id
				const last_message_li = the_fridge.lastElementChild as HTMLLIElement | null;
				if (last_message_li instanceof HTMLLIElement && last_message_li.dataset.messageId) {
					const last_message_id = Number(last_message_li.dataset.messageId);
					query_params = `?before=${last_message_id}`;
				}
			}
			const result = await fetch(`/api/dmv/message/list/${channel_id}${query_params}`, {method: 'GET'});
			if (result.ok){
				const data: MessageRow[] = await result.json();
				// Today, we shall render this data
				for (const [mid, uid, content] of data) {
					const ali = generate_messageli(mid, uid, content);
					the_fridge.appendChild(ali);
				}
			}
		} else {
			// no fridge?
		}
	} catch (err) {
		console.error(err);
	}
}

function generate_messageli(message_id: number, user_id: number, content: string) {
	const mfrag = document.createDocumentFragment();
	try {
		const message_t = document.getElementById('message_t') as HTMLTemplateElement | null;
		if (message_t) {
			const message_f = document.importNode(message_t.content, true);
			const li = message_f.querySelector('li');
			if (li) {
				// set some attributes
				li.setAttribute('data-message-id', String(message_id));
				li.setAttribute('data-user-id', String(user_id));
				// set the content div
				const content_div = li.querySelector('.gmli-content');
				if (content_div) {
					content_div.textContent = content;
				}
				// set the author div to the username
				const author_div = li.querySelector('.gmli-author');
				if (author_div) {
					author_div.textContent = String(user_id);
					const relevant_user = document.querySelector(`.goobo-user[data-user-id="${user_id}"]`) as HTMLLIElement | null;
					if (relevant_user) {
						const the_username = relevant_user.dataset.username;
						if (the_username) {
							author_div.textContent = the_username;
						}
					}
				}
				// glue
				mfrag.appendChild(li);
			}
		}
	}catch(err){
		console.error(err);
	}
	return mfrag;
}

export function gen_gmli(mr?: MessageRow) {
	let dfrag: DocumentFragment | null = null;
	if (Array.isArray(mr) && mr.length === 3) {
		dfrag = generate_messageli(mr[0], mr[1], mr[2]);
	}
	return dfrag ?? document.createDocumentFragment();
}
