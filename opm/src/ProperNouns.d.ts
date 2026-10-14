declare module 'ProperNouns' {
	import dgram from 'node:dgram';
	import {ChildProcess} from 'node:child_process';
	
	export {
		Punch,
		WsEventData,
		WireInfo,
	} from 'PunchSalad';

	/**info about a WebSocket that's connected to WSBC*/
	export interface WsClientInfo {
		ws: WebSocket;
		services: Punch[];
		refreshTimer?: NodeJS.Timeout;
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
