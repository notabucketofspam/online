declare module 'ProperNouns' {
	import dgram from 'node:dgram';
	
	/** Info about some kinda hosted service */
	export interface Punch {
		/**the IP address for someone */
		addr: string;
		/** this is the port for the service that client wants to advertise (ex: 2302) */
		port: number;
		/**this is the name of the server, for display purposes */
		serviceName : string;
		/**Who posted this?*/
		username: string;
	}

	/**info about a WebSocket that's connected to WSBC*/
	export interface WsClientInfo {
		ws: WebSocket;
		services: Punch[];
		copiumTimer?: NodeJS.Timeout;
		refreshTimer?: NodeJS.Timeout;
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

	/**Two (2) UDP sockets*/
	export interface UdpPair {
		/**socket that communicates with the app*/
		factorio_socket: dgram.Socket;
		/**The socket that talks to people outside the home.*/
		punch_socket: dgram.Socket;
	}

}
