/*
	This file has all of the stuff that populates the treeview on the driver-side of the HTML document.
*/

import {
	Channel,
	Guild
} from "./common-core";

import {populate_fridge} from "./burger-parlour.js";
import {populate_guildMembers} from "./criminals.js";

// ========================= and now we actually have to plant some goddamn trees

export async function populate_treeview(){
	try {
		const guild_list = document.getElementById('guild-list');
		const guild_t = document.getElementById('guild_t');
		const channel_t = document.getElementById('channel_t');
		if (guild_list instanceof HTMLUListElement
			&& guild_t instanceof HTMLTemplateElement
			&& channel_t instanceof HTMLTemplateElement) {
			// populate the treeview here			
			const listall = await channelListAll();
			for (const guild of listall) {
				const guildFragment = plantTree(guild);
				guild_list.appendChild(guildFragment);
			}
		} else {
			// couldnt find them
			console.error('missing some stuffs, mate');
		}
	} catch(errr){
		console.error(errr);
	}
}

async function channelListAll(){
	let all_guilds: Guild[] = [];
	try {
		const response = await fetch('/api/dmv/channel/list-all', {method: 'GET'});
		if (response.ok) {
			const data: {guilds: Guild[]} = await response.json();
			all_guilds = data.guilds;
		} else {
			console.error('couldnt get the channel list');
		}
	} catch (errr) {
		console.error(errr);
	}
	return all_guilds;
}

function plantTree(guild: Guild){
	const ret_f = document.createDocumentFragment();
	try {
		const guild_t = document.getElementById('guild_t');
		const channel_t = document.getElementById('channel_t');
		const guild_id = guild.id;
		const guild_name = guild.name;
		const channels = guild.channels;
		if (guild_t instanceof HTMLTemplateElement
		&& channel_t instanceof HTMLTemplateElement
		&& typeof guild_id === 'number'
		&& typeof guild_name === 'string') {
			// import the guild template
			const guild_f = document.importNode(guild_t.content, true);
			// set the guild id
			const goobo_guild = guild_f.querySelector('li.goobo-guild');
			if (goobo_guild instanceof HTMLLIElement)
				goobo_guild.setAttribute('data-guild-id', guild_id.toString());
			// set the guild name
			const ggli_guild_name = guild_f.querySelector('.ggli-guild-name');
			if (ggli_guild_name instanceof HTMLElement)
				ggli_guild_name.textContent = guild_name;
			// actually show the channels
			const ggli_channel_list = guild_f.querySelector('.ggli-channel-list');
			if (ggli_channel_list instanceof HTMLUListElement) {
				for (const {id, name, channel_type} of channels) {
					// import the channel template for each channel
					const channel_f = document.importNode(channel_t.content, true);
					// display the channel id and type
					const goobo_channel = channel_f.querySelector('li.goobo-channel');
					if (goobo_channel instanceof HTMLLIElement) {
						goobo_channel.setAttribute('data-channel-id', id.toString());
						goobo_channel.setAttribute('data-channel-type', channel_type.toString());
						goobo_channel.addEventListener('click', gcli_onclick);
					}
					// display the channel name
					const gcli_channel_name = channel_f.querySelector('.gcli-channel-name');
					if (gcli_channel_name instanceof HTMLElement)
						gcli_channel_name.textContent = name;
					// append it to the guild's channel list
					if (channel_f.firstElementChild)
						ggli_channel_list.appendChild(channel_f.firstElementChild);
				}
			}
			// append it to the return fragment
			if (guild_f.firstElementChild)
				ret_f.appendChild(guild_f.firstElementChild);
		} else {
			// missing the template
		}
	} catch(err) {
		console.error(err);
	}
	return ret_f;
}

async function setActiveChannel(channel_id: number) {
	try {
		const previous_active = document.querySelector('li.goobo-channel.active');
		const new_active = document.querySelector(`li.goobo-channel[data-channel-id="${channel_id}"]`);
		if (previous_active !== new_active) {
			// not the same
			if (previous_active instanceof HTMLLIElement)
				previous_active.classList.remove('active');
			if (new_active instanceof HTMLLIElement)
				new_active.classList.add('active');
			// load the messages for the new channel
			await populate_fridge(channel_id, true);
		}
	} catch (err) {
		console.error(err);
	}
}

async function gcli_onclick(ev: PointerEvent) {
	try {
		const target = ev.currentTarget as HTMLLIElement | null;
		if (target && target.dataset.channelId) {
			const channel_id = Number(target.dataset.channelId);
			// need to focus the guild that this channel belongs to
			const ggli = target.closest('li.goobo-guild');
			if (ggli instanceof HTMLLIElement && ggli.dataset.guildId) {
				const guild_id = Number(ggli.dataset.guildId);
				await setActiveGuild(guild_id);
			}
			// we have to set the focus on this channel after we set focus on the guild,
			// otherwise we shall have no members
			await setActiveChannel(channel_id);
		}
	} catch (err) {
		console.error(err);
	}
}

async function setActiveGuild(guild_id: number) {
	try {
		const activeNow = document.querySelector('li.goobo-guild.active');
		const newActive = document.querySelector(`li.goobo-guild[data-guild-id="${guild_id}"]`);
		if (activeNow !== newActive) {
			// not the same
			if (activeNow instanceof HTMLLIElement)
				activeNow.classList.remove('active');
			if (newActive instanceof HTMLLIElement)
				newActive.classList.add('active');
			// since theyre not the same, we need to refresh the guild-members list
			await populate_guildMembers(guild_id);
		}
	} catch (err) {
		console.error(err);
	}
}

// =======================================================
// ========================= some stuff for a modal dialog

export function init_createGuildButton() {
	const goobo_create_guild = document.getElementById('goobo-create-guild');
	if (goobo_create_guild) {
		goobo_create_guild.addEventListener("click", function(ev) {
			const dialog = theNewGuildModalDialog();
			document.body.appendChild(dialog);
			dialog.showModal();
		});
	}
}

function theNewGuildModalDialog() {
	const dialog = document.createElement('dialog');
	const adiv = document.createElement('div');
	adiv.innerText = 'Create a new guild';
	const form = document.createElement('form');
	form.setAttribute('method', 'dialog');
	const input = document.createElement('input');
	input.setAttribute('type', 'text');
	input.placeholder = 'the name of the guild';
	input.required = true;
	input.name = 'guild_name';
	input.id = 'guild_name';
	form.appendChild(input);
	form.appendChild(document.createElement('BR'));
	const submit_button = document.createElement('button');
	submit_button.setAttribute('type', 'submit');
	submit_button.innerText = 'Create';
	form.appendChild(submit_button);
	dialog.appendChild(adiv);
	dialog.appendChild(form);
	const bdiv = document.createElement('div');
	const exit_button = document.createElement('button');
	exit_button.setAttribute('type', 'button');
	exit_button.innerText = 'EXIT';
	exit_button.addEventListener('click', () => {
		dialog.close();
		dialog.remove();
	});
	form.addEventListener('submit', async function(ev) {
		ev.preventDefault();
		try {
			const guild_name = input.value;
			const response = await fetch('/api/dmv/guild/create', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({guild_name})
			});
			if (response.ok) {
				// guild created successfully
				input.disabled = true;
				submit_button.disabled = true;
				const a_message = document.createElement('div');
				a_message.innerText = 'you made a guild';
				a_message.style.fontWeight = 'bold';
				dialog.appendChild(a_message);
				populate_treeview();
			} else {
				// theres a problem
				console.error(response);
			}
		} catch (err) {
			console.error(err);
		}
	});
	bdiv.appendChild(exit_button);
	dialog.appendChild(bdiv);
	return dialog;
}
