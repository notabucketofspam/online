export type UserInfo = [
	userid: number,
	username: string
];
export interface Channel {
	id: number;
	name: string;
	channel_type: string;
}
export interface Guild {
	id: number;
	name: string;
	channels: Channel[];
}

export type MessageRow = [id: number, user_id: number, content: string];

export interface ListAllGuildsItem {
	guild_id: number;
	guild_name: string;
	owner_id: number;
	owner_username: string;
}
