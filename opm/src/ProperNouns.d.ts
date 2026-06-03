declare module 'ProperNouns' {
	import dgram from 'node:dgram';
	import {ChildProcess} from 'node:child_process';
	
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
		/**sha256 to identify this service*/
		sku: string;
		/**P E R C H A N C E*/
		useRelay?: boolean;
	}

	/**info about a WebSocket that's connected to WSBC*/
	export interface WsClientInfo {
		ws: WebSocket;
		services: Punch[];
		refreshTimer?: NodeJS.Timeout;
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

	/**Two (2) UDP sockets*/
	export interface UdpPair {
		/**socket that communicates with the app*/
		factorio_socket: dgram.Socket;
		/**The socket that talks to people outside the home.*/
		punch_socket: dgram.Socket;
		/**Info about the punch peer*/
		remote_info: dgram.RemoteInfo ;
		/**Helper function to send stuff via punch */
		ps_send: (msg: Buffer) => void;
	}

	export interface SettingsJson {
		is_advertiser: number;
		use_localhost: number;
		use_copium: number;
		[string]: any;
	}

	/** Part of a balanced breakfast */
	export interface Microplastics {
		/** the underlying child process */
		kiddo: ChildProcess;
		/** This is how we make new friends, Gordo. */
		pair_with_peer: (peerIp: string, peerPort: number) => void;
		/** Kill the child process */
		kill_kiddo: () => void;
	}

	/**the command-line arguments for copium*/
	export interface CopiumOptions {
		executablePath: string;
		isServerMode: boolean;
		appPort: number;
		coordHost: string;
		coordPort: number;
		requestId: string;
	}

}
