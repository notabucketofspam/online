import {
	populate_treeview,
} from "./arbor-day.js";

import {
	init_chatinput
} from "./burger-parlour.js";

import {
	init_ListAllGuildsButton
} from "./armodafinil.js";

async function spawn_goobo() {
  const goobo_classic = document.getElementById('goobo-classic');
  if (goobo_classic) {
    // this is all of the init logic
		init_ListAllGuildsButton();
		init_chatinput();
		await populate_treeview();

		//placeholder: activate a channel for now
		const allchannels = Array.from(document.getElementsByClassName('goobo-channel')) as HTMLLIElement[];
		// sort them based on the channel id
		allchannels.sort((a, b) => {
			const a_id = Number(a.dataset.channelId);
			const b_id = Number(b.dataset.channelId);
			return a_id - b_id;
		});
		//click on one of them
		allchannels[0]?.click();
  }
}
document.addEventListener('spam', async (ev) => {
	let cev = ev as CustomEvent;
	let the_url = cev?.detail?.url;
	if (typeof the_url === 'string' && the_url.startsWith('/goobo')) {
    await spawn_goobo();
  }
});
spawn_goobo();
