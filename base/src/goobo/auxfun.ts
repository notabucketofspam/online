
type GuildList = {
	guilds: [id: number, name: string][]
};
type ChannelList = {
	channels: [id: number, name: string, channel_type: number][]
};
export async function guildList() {
	try {
		const response = await fetch('/api/dmv/guild/list', {method: 'GET'});
		if (response.ok) {
			const data: GuildList = await response.json();
			return data.guilds;
		} else {
			console.error('couldnt get the guild list');
			return [];
		}
	} catch (err) {
		console.error(err);
		return [];
	}
}
export async function channelList(guild_id: number) {
	try {
		const response = await fetch(`/api/dmv/channel/list/${guild_id}`, {method: 'GET'});
		if (response.ok) {
			const data: ChannelList = await response.json();
			return data.channels;
		} else {
			console.error('couldnt get the channel list');
			return [];
		}
	} catch (err) {
		console.error(err);
		return [];
	}
}

import type { sinfo } from './common-core';
export async function get_sinfo() {
	let info:sinfo|null = null;
	try {
		const res = await fetch('/api/users/info', {
			method: 'GET',
			cache: 'no-store',
		});
		if (res.ok) {
			info = await res.json();
		}
	} catch (err) {
		console.error(err);
	}
	return info;
}
