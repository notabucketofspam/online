function spawn_goobo() {
  const goobo_classic = document.getElementById('goobo-classic');
  if (goobo_classic) {
    // this is all of the init logic
		init_createGuildButton();
		populate_treeview();
  }
}
document.addEventListener('spam', ev => {
	let cev = ev as CustomEvent;
	let the_url = cev?.detail?.url;
	if (typeof the_url === 'string' && the_url.startsWith('/goobo')) {
    spawn_goobo();
  }
});
spawn_goobo();

// ========================= ========================= ===

function init_createGuildButton() {
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
	form.appendChild(document.createElement('BR') );
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
	form.addEventListener('submit', async function (ev) {
		ev.preventDefault();
		try{
			const guild_name = input.value;
			const response = await fetch('/api/dmv/guild/create', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ guild_name })
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

// ========================= ========================= =============================
// ========================= and now we actually have to plant some goddamn trees

interface Channel {
	id: number;
	name:string;
	channel_type:string;
}
interface Guild {
	id: number;
	name: string;
	channels: Channel[];
}

async function populate_treeview(){
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
	try {
		const response = await fetch('/api/dmv/channel/list-all', {method: 'GET'});
		if (response.ok) {
			const data: {guilds: Guild[]} = await response.json();
			return data.guilds;
		} else {
			console.error('couldnt get the channel list');
			return [];
		}
	} catch (errr) {
		console.error(errr);
		return [];
	}
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
