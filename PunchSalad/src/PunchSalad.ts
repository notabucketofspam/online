/** Info about some kinda hosted service */
export interface Punch {
	/**the IP address for someone */
	addr: string;
	/** this is the port for the service that client wants to advertise (ex: 2302) */
	port: number;
	/**this is the name of the server, for display purposes */
	serviceName: string;
	/**Who posted this?*/
	username: string;
	/**The client is behind a firewall and can't p2p with his broskis,
		* so he's gotta use the WSBC UDP relay.*/
	useRelay?: boolean;
	/**sha256 to identify this service*/
	sku: string;
	/**a list of usernames that can use this service.
		* - empty means "I'm the only one who can use this"
		* - absent means "use my default trusts list" */
	trusts?: string[];
}

export interface WsEventData {
	request_id: string;
	flavour: 'client-open' | 'server-open' | 'peer-punch-port' | 'authn-ok';
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
