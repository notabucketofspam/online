import { populate_treeview } from "./arbor-day.js";
import {
	modal_Framework,
	alert_SIGMA,
	showModalDialog,
	removeModalDialog,
} from "./armodafinil.js";

const CHANNEL_TYPES = ['text', 'voice'];

function modal_CreateChannel(guild_id: number) {
	const dialog = modal_Framework('Create Channel');
	try {
		// the form herself
		const form = document.createElement('form');
		form.setAttribute('method', 'dialog');
		form.setAttribute('data-guild-id', String(guild_id));
		form.addEventListener('submit', Fev_CreateChannel);

		// the area with the name input
		const fs_name = document.createElement('fieldset');
		form.appendChild(fs_name);
		const legend_name = document.createElement('legend');
		legend_name.textContent = 'Channel Name';
		fs_name.appendChild(legend_name);
		const input_name = document.createElement('input');
		fs_name.appendChild(input_name);
		input_name.setAttribute('type', 'text');
		input_name.setAttribute('maxlength', '100');
		input_name.setAttribute('minlength', '1');
		input_name.setAttribute('autocomplete', 'off');
		input_name.placeholder = 'the name of the channel';
		input_name.required = true;
		input_name.name = 'channel_name';
		input_name.id = 'channel_name';

		// the channel type
		const fs_ctype = document.createElement('fieldset');
		form.appendChild(fs_ctype);
		const legend_ctype = document.createElement('legend');
		legend_ctype.textContent = 'Channel Type';
		fs_ctype.appendChild(legend_ctype);
		for (const ctype of CHANNEL_TYPES) {
			const label = document.createElement('label');
			fs_ctype.appendChild(label);
			const input = document.createElement('input');
			label.appendChild(input);
			input.setAttribute('type', 'radio');
			input.required = true;
			input.name = 'channel_type';
			input.value = ctype;
			input.id = `channel_type_${ctype}`;
			const span = document.createElement('span');
			span.textContent = ctype;
			label.appendChild(span);
			label.style.display = 'block';
		}

		// the submit button
		const submit_button = document.createElement('button');
		form.appendChild(submit_button);
		submit_button.setAttribute('type', 'submit');
		submit_button.textContent = 'Make it';

		// glue
		dialog.appendChild(form);
	} catch (err) {
		console.error(err);
	}
	return dialog;
}

export function Bev_CreateChannelModal(ev: PointerEvent) {
	try {
		const target = ev.currentTarget as HTMLButtonElement | null;
		if (target && target.dataset.guildId) {
			const guild_id = Number(target.dataset.guildId);
			const dialog = modal_CreateChannel(guild_id);
			showModalDialog(dialog);
		}
	} catch (err) {
		console.error(err);
	}
}

async function Fev_CreateChannel(ev: SubmitEvent) {
	ev.preventDefault();
	try {
		const form = ev.target as HTMLFormElement | null;
		if (form) {
			const input_name = form.querySelector('input[name="channel_name"]') as HTMLInputElement | null;
			const input_ctype = form.querySelector('input[name="channel_type"]') as HTMLInputElement | null;
			const submit_button = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
			const guild_id = Number(form.getAttribute('data-guild-id'));
			if (input_name && input_ctype && submit_button && guild_id) {
				const channel_name = input_name.value.trim();
				const channel_type = input_ctype.value.trim();
				if (channel_name && channel_type) {
					const response = await fetch('/api/dmv/channel/create', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ channel_name, channel_type, guild_id }),
					});
					if (response.ok) {
						input_ctype.disabled = true;
						input_name.disabled = true;
						submit_button.disabled = true;
						alert_SIGMA('you created a channel');
						populate_treeview();
					} else {
						console.error('Failed to create channel');
						alert_SIGMA('Failed to create channel');
					}
				} else {
					// tried to input blank
				}
			} else {
				// missing some stuff
			}
		} else {
			// no form
		}
	} catch(err){
		console.error(err);
	}
}
