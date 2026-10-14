declare module 'VocabQuiz' {
	import { type WebSocket as ws } from 'ws';

	import type {
		Punch,
		WsEventData,
		WireInfo,
	} from 'PunchSalad';
	export {
		Punch,
		WsEventData,
		WireInfo
	};

	export interface WannaJoin {
		/**the relevant punch sku*/
		sku: string;
		/**it's like WsEventData, but different*/
		flavour: 'wanna-join';
		useRelay?: boolean;
	}

	export interface WsPairMeta {
		client_addr: string;
		client_port: number;
		server_addr: string;
		server_port: number;
		app_port: number;
		use_relay: boolean;
	}

	export interface WsPair {
		wsClient: ws;
		wsServer: ws;
		wsMeta: WsPairMeta;
	}

	export interface ClientData{
		/**The session ID*/
		sid?: string;
		/**All the services that the client wants to list*/
		services: Punch[];
		/** the IP address of this client*/
		addr: string;
		/**the product key they're using to authenticate */
		pkeyInfo ?: PkeyInfo;
		/**some kinda id that tells me who you are*/
		barcode?: string;
		/**this userId, perchance.*/
		userId: number;
		/**username */
		username: string;
	}

	export interface WsbcReply {
		request_id: string;
		flavour: WsEventData['flavour'];
		punch_port: number;
	}

	export interface PkeyInfo {
		pkey: string;
		username : string;
		userId : number;
		email : string;
	}

}
