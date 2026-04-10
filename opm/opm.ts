// the usual gang of idiots
import * as path from "node:path";
import * as fs from "node:fs";
const astext = (x: string) => fs.readFileSync(path.normalize(x), { encoding: "utf8" });
const asnumber = (x: string) => Number(astext(x));
const cog = console.log;

// ===========================================================
// some more setup i guess
import http from "node:http";
import net from "node:net";
import dgram from 'node:dgram';
import https from 'node:https';

// Now that I think about it a bit more,
// we don't really need the local HTTP server at all.
// OPM would always communicate with wsbc via WebSockets anyways.

import {Punch} from 'ProperNouns';

// ===========================================================
/**what are we hosting here?*/
let services: Punch[] = [];
if (fs.existsSync('notkeys/services.json')) {
	// we remembered to write it down before we left
	const services_json = astext('notkeys/services.json');
	services = JSON.parse(services_json) as Punch[];
	cog("Hosting these services:");
	cog(services);
} else {
	// i got nothin
	fs.writeFileSync('notkeys/services.json', '[]', {encoding: 'utf8'});
}

// ==================================================================
// actually gotta talk to the waluigi-servebeer.com server for a sec
// authorization and authentication and all that
const useLocalhost = fs.existsSync('notkeys/use-localhost.txt')&&Boolean(asnumber('notkeys/use-localhost.txt'));
const useHostname = useLocalhost ? 'localhost' : 'waluigi-servebeer.com';
const http_request = useLocalhost ? http.request : https.request;

type PromiseResolve = (value : unknown) => void;
type PromiseReject = (reason ?: any) => void;

// try to log in with cookie, if we have one.
// failing that, log in with email and password.
function init_login(){
	return new Promise((resolve, reject) => {
		if (fs.existsSync('notkeys/cookie.txt')) {
			loginWithCookie(resolve, reject);
		} else {
			loginWithUserCredentials(resolve, reject);
		}
	});
}

// we actually *do* have a cookie, so let's try to use that instead
function loginWithCookie(resolve: PromiseResolve, reject: PromiseReject){
	const loginReqOptions : http.RequestOptions = {
		hostname: useHostname,
		path: '/api/users/info',
		method: 'GET',
		headers: {
			'Cookie': astext('notkeys/cookie.txt')
		}
	};
	const loginReq = http_request(loginReqOptions, res => {
		//cog(`HTTP ${res.statusCode}`);
		//cog(res.headers);

		if (typeof res.statusCode === 'undefined' || res.statusCode < 200 || res.statusCode >= 300){
			// the cookie didn't work, so now we gotta log in with credentials
			return loginWithUserCredentials(resolve, reject);
		} else {
			cog('cookie login successful');
			// we honestly don't care about the rest of it
			resolve(0);
		}

	});
	loginReq.end();
}

// we dont have a cookie, so we need to log in and then get the cookie
function loginWithUserCredentials(resolve: PromiseResolve, reject: PromiseReject){
	const loginBody = JSON.stringify({email: astext('notkeys/email.txt'), password: astext('notkeys/password.txt')});
	const loginReqOptions: http.RequestOptions = {
		hostname: useHostname,
		path: '/api/users/login',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(loginBody)
		}
	};

	const loginReq = http_request(loginReqOptions, res=>{
		//cog(`HTTP ${res.statusCode}`);
		//cog(res.headers);

		if (typeof res.statusCode === 'undefined' || res.statusCode < 200 || res.statusCode >= 300){
			throw new Error('credential error');
		}

		// check the cookie header
		const setCookie = res.headers['set-cookie'];
		if (typeof setCookie === 'undefined' || typeof setCookie[0] === 'undefined') {
			throw new Error('login problem');
		}
		const scMatch = setCookie[0].match(/connect\.sid=.*?;/g);
		if (scMatch === null || typeof scMatch[0] === 'undefined'){
			throw new Error("problem with the 'set-cookie' HTTP header (it's not your fault)");
		}
		let schism = scMatch[0];
		while (schism.endsWith(';')){
			// get rid of the trailing semicolon(s)
			schism = schism.slice(0, -1);
		}

		// record the cookie for future use
		fs.writeFileSync('notkeys/cookie.txt', schism, {encoding:'utf8'});

		res.setEncoding('utf8');
		let somedata = "";
		const ondata = (chunk:any)=>{
			somedata += chunk;
		};
		res.on("data", ondata);
		res.once('end', () => {
			res.off('data', ondata);
			//cog(`BODY: ${somedata}`);
			cog('credential login successful');
			resolve(0);
		});
	});

	loginReq.once('error', err=>{
		console.error(err);
	});
	loginReq.write(loginBody);
	loginReq.end();
}

// ============================================================
// websocket client

import {WsClientInfo} from 'ProperNouns';

/**stupid fix bc the 'X-Forwarded-For' header kept getting messed up*/
const allowUnsafeAddr = fs.existsSync('notkeys/allow-unsafe-addr.txt')&&Boolean(asnumber('notkeys/allow-unsafe-addr.txt'));

/** 
 * we need two different websockets bc WSBC uses
 * the 'X-Forwarded-For' HTTP header to determine our IP
 */
const wsClients: Record<string, WsClientInfo> = {};

/** do this once at startup*/
function init_websockets() {	
	let wsUrl6 = `ws://localhost/wss`;
	let ws6_services = services;

	if (!useLocalhost && !allowUnsafeAddr) {
		wsUrl6 = `wss://6.waluigi-servebeer.com/wss`;
		ws6_services = services.filter(punch=>punch.addr.includes(':'));

		let wsUrl4 = `wss://4.waluigi-servebeer.com/wss`;
		let ws4 = new WebSocket(wsUrl4)
		ws4.addEventListener('close', onceWsClose, {once:true});
		ws4.addEventListener('open', onceWsOpen, {once:true});	
		wsClients[wsUrl4] = {ws: ws4, services: services.filter(punch=>punch.addr.includes('.'))};
	} else if (!useLocalhost && allowUnsafeAddr){
		wsUrl6 = `wss://waluigi-servebeer.com/wss`;
	}
	let ws6 = new WebSocket(wsUrl6);
	ws6.addEventListener('close', onceWsClose, {once:true});
	ws6.addEventListener('open', onceWsOpen, {once:true});
	wsClients[wsUrl6] = {ws: ws6, services: ws6_services};
}

/** this will be called every-so-often when we're attempting to cope */
function reinit_websocket(ws: WebSocket) {	
	ws.removeEventListener('open', onceWsOpen);
	ws.removeEventListener('close', onceWsClose);

	let wsUrl = ws.url;
	let newWs = new WebSocket(wsUrl);
	newWs.addEventListener('open', onceWsOpen, {once:true});
	newWs.addEventListener('close', onceWsClose, {once: true});

	wsClients[wsUrl]!.ws = newWs;
}

const refreshTime = 10000;
/**
 * this is how we tell WSBC that we are hosting stuff
 * @param ws
 */
function refreshListings(ws: WebSocket){
	try{
		// send a ping frame
		ws.send(Buffer.from([0x9]));
		// send the actual listings
		const _services = wsClients[ws.url]?.services ?? [];
		ws.send(JSON.stringify(_services));
	} catch (err){
		console.error(err);
	}
}

const postingAds = fs.existsSync('notkeys/is-advertiser.txt');

// -------------------------------------- websocket event listeners

import {WsEventData} from 'ProperNouns';

const socketMap: Map<string, UdpPair> = new Map();

async function onWsMessage (ev : MessageEvent) {
	// we shall open a udp socket and send something
	// to the specified address and port
	let ws = ev.target as WebSocket;
	cog(ev.data);
	if (typeof ev.data === 'string') {
		const ev_data: WsEventData = JSON.parse(ev.data);
		const {request_id, flavour, wx} = ev_data;

		if (flavour === 'client-open' || flavour === 'server-open') {
			// WSBC (the game coordinator) wants us to reach out to someone
		
			// make some new UDP sockets
			const udp_pair = await createUdpPair(wx);
			const punch_port = udp_pair.punch_socket.address().port;
			
			if (flavour === 'client-open') {
				// temporarily keep track of stuff
				socketMap.set(request_id, udp_pair);
				setTimeout(function(){
					socketMap.delete(request_id);
				}, 10000);
			} else if (flavour === 'server-open') {
				// associate this punch_socket with a remote client
				udp_pair.punch_socket.connect(wx.remote_port, wx.remote_addr, ()=>{
					// its probably fine
				});
			}

			// tell WSBC about our punch_port
			const wsbc_reply = {
				request_id,
				flavour,
				punch_port
			};
			ws.send(JSON.stringify(wsbc_reply));
		} else if (flavour === 'peer-punch-port') {
			// we are a client, and we've just received the server's punch port

			const udp_pair = socketMap.get(request_id);
			if (typeof udp_pair !== 'undefined' ){
				// associate our punch_socket with the server
				udp_pair.punch_socket.connect(wx.remote_port, wx.remote_addr, ()=>{} );
			}
		} else {
			// this shouldn't happen
		}
		
	} else {
		// probs a pong frame, so just ignore
	}
}

function onWsError (ev : Event) {
	let ws = ev.target as WebSocket;
	console.error(`[${ws.url}]`, ev);
}

function onceWsClose(ev: CloseEvent){
	let ws = ev.target as WebSocket;

	cog(`[${ws.url}] closed: [code: ${ev.code}] [reason: ${ev.reason||'none'}] [clean: ${ev.wasClean}]`);

	ws.removeEventListener('message', onWsMessage);
	ws.removeEventListener('error', onWsError);
	if (wsClients[ws.url]?.refreshTimer){		
		clearInterval(wsClients[ws.url]?.refreshTimer);
	}
	// and now we have to wait and see if the server goes back up
		cog(`[${ws.url}] attempting to cope...`);
		setTimeout(() => {
			reinit_websocket(ws);
		}, 2000);
}

function onceWsOpen (ev: Event) {
	let ws = ev.target as WebSocket;

	cog(`[${ws.url}] open`);

	ws.addEventListener('error', onWsError);
	ws.addEventListener('message', onWsMessage);

	// we need to send login info to the server,
	// but we can't do that with the default WebSocket constructor,
	// since it doesn't let us set our own headers
	ws.send(JSON.stringify({'Cookie': astext('notkeys/cookie.txt')}));

	refreshListings(ws);
	wsClients[ws.url]!.refreshTimer = setInterval(()=>{
		refreshListings(ws);
	}, refreshTime);
	if (wsClients[ws.url]?.copiumTimer) {
		clearTimeout(wsClients[ws.url]?.copiumTimer);
	}
}

// ============================================================
// the udp stuff

async function createUdpSocket (family : 'udp4' | 'udp6', options: dgram.BindOptions) {
	const socket = dgram.createSocket(family);

	socket.on('error', onUdpSocketError);
	socket.once('close', function () {
		cog(`udp socket closed`);
		socket.off('error', onUdpSocketError);
	});
	// prevent some kinda race condition
	const promise = new Promise<void>((resolve, reject) => {
		socket.once('listening', () => {
			const address = socket.address();
			cog(`udp socket listening on ${address.address},${address.port}`);
			resolve();
		});
	});

	socket.bind(options);
	await promise;

	return socket;
}

function onUdpSocketError (err : Error) {
	console.error(`udp socket error: ${err}`);
}

// ===========================================================
// please don't shake the lightbulb

import {WireInfo, UdpPair} from 'ProperNouns';

/**This is what we use for PersistentKeepalive */
const punchMsg = Buffer.from("PUNCH");

async function createUdpPair(wx: WireInfo): Promise<UdpPair>{
	
	/**
	 * if we are a server, we use this to pretend to be a client (ie, let it be random).
	 * if we are a client, this mocks the server's port (ie, 34197).
	 */
	let pseudo_port = postingAds ? 0 : wx.app_port;
	
	// set up factorio listener
	const factorio_address = '127.0.0.1';
	let factorio_dynamic_port = 0;
	const factorio_socket = await createUdpSocket('udp4', {
		port: pseudo_port, 
		address: factorio_address
	});

	// received a message from factorio.exe
	function fs_onmessage(msg: Buffer, rinfo: dgram.RemoteInfo){
		factorio_dynamic_port = rinfo.port;
		ps_send(msg);
	}
	factorio_socket.on('message', fs_onmessage);

	// set up punch listener
	const fam = net.isIPv6(wx.remote_addr) ? 'udp6' : 'udp4';
	const address = net.isIPv6(wx.remote_addr) ? '::1' : '127.0.0.1';
	const punch_socket = await createUdpSocket(fam, {address});
	
	// if we don't receive a message from our punch peer in time, assume
	// that we had a disconnect
	function destroyUdpPair() {
		// clear the keepalive
		clearTimeout(PersistentKeepalive);

		// kill factorio socket
		factorio_socket.off('message', fs_onmessage);
		factorio_socket.close();
		factorio_socket.unref();

		// kill punch socket
		punch_socket.off('message', ps_onmessage);
		try {
			punch_socket.disconnect();
		} catch(err){}
		punch_socket.close(()=>{
			cog('punch socket closed');
		});
		punch_socket.unref();
	}
	let DeathTimer = setTimeout(destroyUdpPair, 60000);

	// received a message from our punch peer
	function ps_onmessage(msg: Buffer, rinfo: dgram.RemoteInfo){
		// the connection is still alive (for now)
		DeathTimer.refresh();
		// filter out keepalives
		if (msg.compare(punchMsg)){
			// forward this to factorio
			factorio_socket.send(msg, factorio_dynamic_port, factorio_address, (err, bytes)=>{
				if (err) cog('factorio_socket', err);					
			});
		}
	}
	punch_socket.on('message', ps_onmessage);

	// punch sending helper function
	function ps_send(msg: Buffer){
		punch_socket.send(msg, (err, bytes)=>{
			if (err) cog('punch_socket', err);					
		});
	}

	// keep the hole punched
	let PersistentKeepalive = setInterval(() => {
		ps_send(punchMsg);
	}, 25000);

	// give the audience what they want
	return {factorio_socket, punch_socket};
}

// ============================================================
// final bit of setup
async function init_real(){
	await init_login();
	init_websockets();
}
init_real();



