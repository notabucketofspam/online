declare module 'VocabQuiz' {

	export interface Punch {
		/**the IP address for someone */
		addr: string;
		/** this is the port for the service that client wants to advertise (ex: 2302) */
		port: number;
		/**this is the name of the server, for display purposes */
		serviceName : string;
		/**Who posted this?*/
		username: string;
		/**The client is behind a firewall and can't p2p with his broskis,
		 * so he's gotta use the WSBC UDP relay.*/
		useRelay?: boolean;
		/**sha256 to identify this service*/
		sku: string;
	}

	export interface WsEventData {
		request_id: string;
		flavour: 'client-open'|'server-open'|'peer-punch-port' | 'authn-ok';
		wx: WireInfo;
	}

	/**More specific connection info*/
	export interface WireInfo {
		/**the port for the app that we want to punch for*/
		app_port: number;
		/**our punch peer's IP address*/
		remote_addr: string;
		/**The punch peer's punch port*/
		remote_port: number;
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
