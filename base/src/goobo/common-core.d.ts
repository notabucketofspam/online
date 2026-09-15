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
	owner_id: number;
	id: number;
	name: string;
	channels: Channel[];
}

export interface sinfo {
	userId: number;
	username: string;
	email: string;
}

export type MessageRow = [id: number, user_id: number, content: string];

export interface ListAllGuildsItem {
	guild_id: number;
	guild_name: string;
	owner_id: number;
	owner_username: string;
}

// some stuff for websockets

export type WsFlavour = 'authn-ok' | 'gmail';

export interface WsEventData {
	flavour: WsFlavour;
}

export type GatewayGrade =
	'M_CREATE' | 'M_UPDATE' | 'M_DELETE' |
	'C_CREATE' | 'C_UPDATE' | 'C_DELETE' |
	'G_CREATE' | 'G_UPDATE' | 'G_DELETE' | 'G_JOIN';

export interface GatewayItem extends WsEventData {
	flavour: 'gmail';
	grade: GatewayGrade;
}

export interface MessageCreate extends GatewayItem {
	channel_id: number;
	grade: 'M_CREATE';
	message_row: MessageRow;
}

export interface MessageUpdate extends GatewayItem {
	channel_id: number;
	grade: 'M_UPDATE';
	message_row: MessageRow;
}

export interface MessageDelete extends GatewayItem {
	channel_id: number;
	grade: 'M_DELETE';
	message_id: number;
}

