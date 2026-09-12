/*This file has stuff that lets you make modal dialogues,
	which I think is pretty cool.
*/


import {
	type ListAllGuildsItem
} from "./common-core";

export function init_ListAllGuildsButton() {
	try {
		const button = document.getElementById('goobo-list-all-guilds');
		if (button) {
			button.addEventListener('click', function(ev) {
				modal_ListAllGuilds().then(dialog => {
					showModalDialog(dialog);
				});
			});
		}
	} catch (err) {
		console.error(err);
	}
}

export async function listAllGuilds() {
	let guilds: ListAllGuildsItem[] = [];
	try {
		const response = await fetch('/api/dmv/guild/list-all', {method: 'GET'});
		if (response.ok) {
			const data = await response.json();
			guilds = data.guilds ?? [];
		}
	} catch (err) {
		console.error(err);
	}
	return guilds;
}
//@ts-ignore
import MediaPlayer from "/dist/extern/MediaPlayer.js";
const wmp = new MediaPlayer();

export async function modal_ListAllGuilds() {
	const dialog = modal_Framework("List of Guilds");
	try {
		/**this is the div that has most of the important content*/
		const bigdiv = document.createElement('div');
		dialog.appendChild(bigdiv);

		/**a button that lets you make a new guild*/
		const createGuildButton = document.createElement('button');
		createGuildButton.textContent = 'Create a New Guild';
		createGuildButton.addEventListener('click', Bev_CreateGuildModal);
		// disable for now, for safe keeping
		createGuildButton.disabled = true;
		bigdiv.appendChild(createGuildButton);

		/**this is a sample button that lets you test the alert_SIGMA function*/
		const ModerButton = document.createElement('button');
		ModerButton.textContent = 'Moder Power';
		ModerButton.style = "display:inline-block; margin-left: 1em;"; 
		ModerButton.addEventListener('click', () => {
			alert_SIGMA('Moder still cries');
			wmp.beep('/page/soundboard/opodes/Gamer/moder.opus');
		});
		bigdiv.appendChild(ModerButton);

		/**this table will have a bunch of guilds in it */
		const table = document.createElement('table');
		table.classList.add("list-all-guilds");
		bigdiv.appendChild(table);
		const thead = document.createElement('thead');
		table.appendChild(thead);
		const headerRow = document.createElement('tr');
		const headers = ['Guild Name','Owner', "JOIN???"];
		for (const headerText of headers) {
			const th = document.createElement('th');
			th.textContent = headerText;
			headerRow.appendChild(th);
		}
		thead.appendChild(headerRow);
		const tbody = document.createElement('tbody');
		table.appendChild(tbody);

		listAllGuilds().then(guilds => {
			for (const guild of guilds) {
				const row = document.createElement('tr');
				// add the guild name, with the guild id as the title attribute
				const guildNameCell = document.createElement('td');
				guildNameCell.textContent = guild.guild_name;
				guildNameCell.title = String(guild.guild_id);
				row.appendChild(guildNameCell);
				// now do the same, but with the owner name and id
				const ownerCell = document.createElement('td');
				ownerCell.textContent = guild.owner_username;
				ownerCell.title = String(guild.owner_id);
				row.appendChild(ownerCell);
				// and, finally, add a button to join the guild
				const joinButton = document.createElement('button');
				joinButton.textContent = 'Join';
				joinButton.setAttribute("data-guild-id", String(guild.guild_id));
				joinButton.addEventListener('click', Bev_JoinGuild);
				joinButton.classList.add('join-guild');
				// check to make sure the user is not already a member of the guild, and if they are, disable the button
				const existing_guild = document.querySelector(`li.goobo-guild[data-guild-id="${guild.guild_id}"]`);
				// console.log(`existing_guild: ${existing_guild}`);
				if (existing_guild) {
					joinButton.disabled = true;
					joinButton.textContent = 'joined';
				}
				const joinCell = document.createElement('td');
				joinCell.appendChild(joinButton);
				row.appendChild(joinCell);
				// and then add the row to the table body
				tbody.appendChild(row);
			}
		});
	} catch (err) {
		console.error(err);
	}
	return dialog;
}

async function Bev_JoinGuild(ev: PointerEvent) {
	try {
		const target = ev.target as HTMLElement;
		const guild_id = target.getAttribute("data-guild-id");
		if (guild_id) {
			const success = await joinGuildById(Number(guild_id));
			if (success) {
				alert_SIGMA(`Successfully joined guild ${guild_id}`);
			} else {
				alert_SIGMA(`Failed to join guild ${guild_id}`);
			}
		}
	} catch (err) {
		console.error(err);
	}
}

async function joinGuildById(guild_id: number) {
	let is_ok = false;
	try {		
		const response = await fetch(`/api/dmv/guild/join`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({guild_id: Number(guild_id)})
		});
		if (response.ok) {
			is_ok = true;
		}
	} catch(err){
		console.error(err);
	}
	return is_ok;
}

function Bev_KillModal(ev: PointerEvent) {
	try {
		const target = ev.target as HTMLElement;
		const dialog = target.closest('dialog');
		removeModalDialog(dialog);
	} catch (err) {
		console.error(err);
	}
}

export function modal_Framework(title: string, content?:HTMLElement | DocumentFragment) {
	const dialog = document.createElement('dialog');
	const headingDiv = document.createElement('div');
	headingDiv.classList.add('modal-heading');
	const titleSpan = document.createElement('span');
	titleSpan.textContent = title;
	titleSpan.classList.add('modal-title');
	headingDiv.appendChild(titleSpan);
	const closeButton = document.createElement('button');
	closeButton.addEventListener('click', Bev_KillModal);
	closeButton.textContent = 'Close';
	closeButton.classList.add('modal-close');
	dialog.appendChild(headingDiv);
	headingDiv.appendChild(closeButton);
	if (content) {
		dialog.appendChild(content);
	}
	return dialog;
}

export function alert_SIGMA(text: string) {
	const dialog = modal_Framework('Alert');
	dialog.classList.add('alert-sigma');
	const div = document.createElement('div');
	div.textContent = text;
	dialog.appendChild(div);
	showModalDialog(dialog);
}

function showModalDialog(dialog: Element | null) {
	if (dialog && dialog instanceof HTMLDialogElement) {
		document.body.appendChild(dialog);
		dialog.showModal();
	}
}
function removeModalDialog(dialog: Element | null) {
	if (dialog && dialog instanceof HTMLDialogElement) {
		dialog.close();
		dialog.remove();
	}
}

import {
	populate_treeview
} from "./arbor-day.js";

function Bev_CreateGuildModal(ev: PointerEvent) {
	try {
		const dialog = modal_CreateGuild();
		showModalDialog(dialog);
	} catch (err) {
		console.error(err);
	}
}

function modal_CreateGuild() {
	const dialog = modal_Framework("Create Guild");
	try {
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
		dialog.appendChild(form);		
		form.addEventListener('submit', Fev_CreateGuild);
	} catch (err) {
		console.error(err);
	}
	return dialog;
}

async function Fev_CreateGuild(ev: SubmitEvent) {
	ev.preventDefault();
	try {
		const form = ev.currentTarget as HTMLFormElement | null;
		if (form) {
			const input = form.querySelector('input[name="guild_name"]') as HTMLInputElement | null;
			const submit_button = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
			if (input && submit_button) {
				const guild_name = input.value;
				if (guild_name.trim().length > 0) {
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
						alert_SIGMA('you made a guild');
						populate_treeview();
					} else {
						// theres a problem
						console.error(response);
					}
				} else {
					// looks like the guild name was left blank-ish
				}
			} else {
				// cant find some of the elements that we need
			}
		} else {
			// The Form Hath Gone Missing!
		}
	} catch (err) {
		console.error(err);
	}
}
