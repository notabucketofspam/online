/*
	This file deals with the list of users on the right-hand side.
	We refer to such folks as "CRIMINALS."
*/

import {UserInfo} from "./common-core";

export async function getUsers(guild_id:number) {
	let users: UserInfo[] = [];
	try {
		const response = await fetch(`/api/dmv/guild/list-users/${guild_id}`, {
			cache: 'no-store',
			method: 'GET'
		});
		if (response.ok) {
			const data = await response.json();
			users = data.users;
		} else {
			console.error('couldnt get users in guild');
		}
	} catch (err) {
		console.error(err);
	}
	return users;
}

export async function populate_guildMembers(guild_id:number){
	try {
		const guild_members = document.getElementById('guild-members') as HTMLUListElement | null;
		if (guild_members){
			const users = await getUsers(guild_id);
			for (const [user_id, username] of users) {
				const userli = generate_userli(user_id, username);
				guild_members.appendChild(userli);
			}
		} else {
			// looks like that guy is missing, oops lol
		}
	} catch (err) {
		console.error(err);
	}
}

function generate_userli(user_id: number, username: string) {
	const ret_f = document.createDocumentFragment();
	try {
		const user_t = document.getElementById('user_t') as HTMLTemplateElement | null;
		if (user_t) {
			// import the user template into the document fragment
			const user_f = document.importNode(user_t.content, true);
			// set the user_id and username
			const goobo_user = user_f.querySelector('li.goobo-user');
			if (goobo_user instanceof HTMLLIElement) {
				goobo_user.setAttribute('data-user-id', String(user_id));			
				goobo_user.setAttribute('data-username', username);
			}
			// display the username in the div element
			const guli_username = user_f.querySelector('.guli-username');
			if (guli_username instanceof HTMLDivElement) {
				guli_username.textContent = username;
			}
			// append it
			if (user_f.firstElementChild)
				ret_f.appendChild(user_f.firstElementChild);
		} else {
			// couldnt find the user template
		}
	} catch(err){
		// eh
	}
	return ret_f;
}
