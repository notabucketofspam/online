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
		/**The joining client shall send this. Please don't use in production bc
		 * it can be easily spoofed. Trust no one, not even yourself.*/
		unsafeAddr?: string;
	}

	export interface WsEventData {
		request_id: string;
		flavour: 'client-open'|'server-open'|'peer-punch-port';
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
	}

	export interface WsPair {
		wsClient: ws;
		wsServer: ws;
		wsMeta: WsPairMeta;
	}

	export interface ClientData{
		/**The session ID*/
		sid: string;
		/**All the services that the client wants to list*/
		services: Punch[];
		/** the IP address of this client*/
		addr: string;
	}

	export interface WsbcReply {
		request_id: string;
		flavour: WsEventData['flavour'];
		punch_port: number;
	}

}
