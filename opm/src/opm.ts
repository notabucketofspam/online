// the usual gang of idiots
import * as path from "node:path";
import * as fs from "node:fs";
const astext = (x: string) => fs.readFileSync(path.normalize(x), { encoding: "utf8" });
const existsSync = (x: string) => fs.existsSync(path.normalize(x));
const cog = console.log;

// some more setup i guess
import http from "node:http";
import net from "node:net";
import dgram from 'node:dgram';
import https from 'node:https';
import process from 'node:process';

import {Punch, SettingsJson} from 'ProperNouns';
const grandFacade_port = 39688;
const grandFacade_addr = '4.waluigi-servebeer.com';

// ================================================================================================
// ===================================== services and settings ====================================
// ================================================================================================

fs.mkdirSync('opm-data', {recursive:true});

/**This is how we know stuff*/
const settings: SettingsJson = {
	is_advertiser: 0,
	use_localhost: 0,
	use_copium: 0
};

/** try to load settings from disk */
function init_settings() {
	if (existsSync('opm-data/settings.json')) {
		// settings we have some
		try {
			const savefile = JSON.parse(astext('opm-data/settings.json')) as SettingsJson;
			for (const key in settings) {
				if (typeof settings[key] === typeof savefile[key]) {
					settings[key] = savefile[key];
				}
			}

			// apply settings to things in the global scope that need it
			wsbc_hostname = settings.use_localhost ? 'localhost' : 'waluigi-servebeer.com';
			http_request = settings.use_localhost ? http.request : https.request;
			ws_protocol = settings.use_localhost ? `ws:` : `wss:`;
			onWsMessage_actual = settings.use_copium ? onWsMessage_copium : onWsMessage;
		} catch (err) {
			cog("can't load settings, skipping...");
		}
	}
	saveSettings();
}

/** re-save our settings to disk */
function saveSettings() {
	fs.writeFileSync('opm-data/settings.json', JSON.stringify(settings, null, 2), {encoding: 'utf8'});
}

/**what are we hosting here?*/
let services: Punch[] = [];
/**Are you qualified to advertise with WSBC?*/
let postingAds = false;
/**zilchware */
const empty_service: Punch = {
	addr: "",
	port: 0,
	serviceName: "",
	username: ""
};

function init_ads(){
	if (existsSync('opm-data/services.json') && settings.is_advertiser) {
		try {
			// we remembered to write it down before we left
			const services_json = astext('opm-data/services.json');
			services = JSON.parse(services_json) as Punch[];
			cog("Hosting these services:");
			cog(services);
			// by default, we post ads if we have them
			postingAds = true;
		} catch(err){
			cog("Failure to read services file. Check your syntax.");
		}
	} else if (existsSync('opm-data/services.json') && !settings.is_advertiser) {
		cog(`If you wanna post ads, you need to have "is_advertiser":1 in your settings.json`);
	} else if (!existsSync('opm-data/services.json') && settings.is_advertiser){
		cog(`Go find a services file somewhere`);
	} else {
		// i got nothin
		cog("You have elected to host zero services.");
		services = [empty_service ];
	}
}

// ================================================================================================
// ========================================== HELLA HTTP ==========================================
// ================================================================================================

// actually gotta talk to the waluigi-servebeer.com server for a sec
// authorization and authentication and all that
var wsbc_hostname = 'waluigi-servebeer.com';
var http_request: typeof http.request | typeof https.request = https.request;

type PromiseResolve<T> = (value : T) => void;
type PromiseReject = (reason ?: any) => void;

// try to log in with cookie, if we have one.
// failing that, log in with email and password.
async function init_login(){
	return await new Promise<void>(async (resolve, reject) => {
		if (existsSync('opm-data/product-key.json')) {
			console.log('Using product key to authenticate');
			resolve();
		} else if (existsSync('opm-data/cookie.txt')) {
			await loginWithCookie(resolve, reject);
		} else {
			await loginWithUserCredentials(resolve, reject);
		}
	});
}

/** we actually *do* have a cookie, so let's try to use that instead */
async function loginWithCookie(resolve: PromiseResolve<void>, reject: PromiseReject){
	const loginReqOptions : http.RequestOptions = {
		hostname: wsbc_hostname,
		path: '/api/users/info',
		method: 'GET',
		headers: {
			'Cookie': astext('opm-data/cookie.txt')
		}
	};
	const loginReq = http_request(loginReqOptions, async (res) => {

		if (typeof res.statusCode === 'undefined' || res.statusCode < 200 || res.statusCode >= 300){
			// the cookie didn't work, so now we gotta log in with credentials
			return await loginWithUserCredentials(resolve, reject);
		} else {
			cog('cookie login successful');
			// we honestly don't care about the rest of it
			resolve();
		}

	});
	loginReq.end();
}

/**we dont have a cookie, so we need to log in and then get the cookie */
async function loginWithUserCredentials(resolve: PromiseResolve<void>, reject: PromiseReject){
	
	const {user_email, user_password} = await getLoginCredentials();

	const loginBody = JSON.stringify({
		email: user_email, 
		password: user_password
	});
	const loginReqOptions: http.RequestOptions = {
		hostname: wsbc_hostname,
		path: '/api/users/login',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(loginBody)
		}
	};

	const loginReq = http_request(loginReqOptions, res=>{

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
		fs.writeFileSync('opm-data/cookie.txt', schism, {encoding:'utf8'});

		res.setEncoding('utf8');
		let somedata = "";
		const ondata = (chunk:any)=>{
			somedata += chunk;
		};
		res.on("data", ondata);
		res.once('end', () => {
			res.off('data', ondata);
			cog('credential login successful');
			resolve();
		});
	});

	loginReq.once('error', err=>{
		console.error(err);
	});
	loginReq.write(loginBody);
	loginReq.end();
}

import * as readline from "node:readline/promises";
/**We don't wanna save the username/password to disk as plaintext*/
async function getLoginCredentials(){
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: ''
	});
	rl.write("Gotta login to your account on waluigi-servebeer.com\r\n");
	const user_email = await rl.question("What's your account's email address?\r\n");
	const user_password = await rl.question("Ok cool. And what's your password?\r\n");
	rl.write("Thank you !!!\r\n");

	// wanna hide the username/password from prying eyes
	const rl_jr = new readline.Readline(process.stdout);
	// remove password
	rl_jr.moveCursor(0, -2);
	rl_jr.clearLine(0);
	rl_jr.cursorTo(0);
	await rl_jr.commit();
	process.stdout.write('<and this is where your password used to be>');
	// remove email
	rl_jr.moveCursor(0, -2);
	rl_jr.clearLine(0);
	rl_jr.cursorTo(0);
	await rl_jr.commit();
	process.stdout.write('<this is where your email address was>');
	// put the cursor back where it was
	rl_jr.moveCursor(0, 4);
	rl_jr.cursorTo(0);
	await rl_jr.commit();

	rl.close();
	return {user_email, user_password};
}

function genericHttpRequest(options: http.RequestOptions, dataToWrite?: any): Promise<unknown>{
	return new Promise<unknown>((resolve, reject)=>{
		const req = http_request(options, res=>{

			if (typeof res.statusCode === 'undefined' || res.statusCode < 200 || res.statusCode >= 300){
				// not ok
				reject(res);
			}
			
			res.setEncoding('utf8');
			let somedata = "";
			const res_ondata = (chunk:any)=>{
				somedata += chunk;
			};
			res.on("data", res_ondata);
			res.once('end', () => {
				res.off('data', res_ondata);
				req.off('error', req_onerror);
				resolve(somedata);
			});

		});
		if (typeof dataToWrite !== 'undefined'){
			req.write(dataToWrite);
		}
		const req_onerror = (err: Error)=>{
			reject(err);
		}
		req.on('error', req_onerror);
		req.end();
	});
}
const realStacks = {
	v4: true,
	v6: true
};
/**This is how we know if the client's network supports IPv4 and/or IPv6*/
async function determineRealStacks(){
	try {
		await genericHttpRequest({hostname: '4.waluigi-servebeer.com'});
	} catch(err){
		//console.error(err);
		realStacks.v4 = false;
	}
	try {
		await genericHttpRequest({hostname: '6.waluigi-servebeer.com'});
	} catch(err){
		//console.error(err);
		realStacks.v6 = false;
	}
}

// ================================================================================================
// ======================================= websocket client =======================================
// ================================================================================================

import {WsClientInfo} from 'ProperNouns';

var ws_protocol = 'wss:';

/** 
 * we need two different websockets bc WSBC uses
 * the 'X-Forwarded-For' HTTP header to determine our IP
 */
const wsClients: Record<string, WsClientInfo> = {};

/** do this once at startup*/
function init_websockets() {
	if (!settings.use_localhost && postingAds) {
		// we are an advertiser and/or local dev
		if (realStacks.v4){
			// init for IPv4
			let wsUrl4 = `${ws_protocol}//4.${wsbc_hostname}/wss`;
			const ws4_services = services;
			let ws4 = new WebSocket(wsUrl4)
			ws4.addEventListener('close', onceWsClose, {once:true});
			ws4.addEventListener('open', onceWsOpen, {once:true});	
			wsClients[wsUrl4] = {ws: ws4, services: ws4_services};
		}
		if (realStacks.v6){
			// init for IPv6
			let wsUrl6 = `${ws_protocol}//6.${wsbc_hostname}/wss`;
			let ws6_services = services;
			let ws6 = new WebSocket(wsUrl6);
			ws6.addEventListener('close', onceWsClose, {once:true});
			ws6.addEventListener('open', onceWsOpen, {once:true});
			wsClients[wsUrl6] = {ws: ws6, services: ws6_services};
		}
	} else{
		// we are a client, so just connect in the most convenient way
		let wsUrlx = `${ws_protocol}//${wsbc_hostname}/wss`;
		let wsx_services = services;
		let wsx = new WebSocket(wsUrlx);
		wsx.addEventListener('close', onceWsClose, {once:true});
		wsx.addEventListener('open', onceWsOpen, {once:true});
		wsClients[wsUrlx] = {ws: wsx, services: wsx_services};
	}
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

const refreshTime = 25000;
/**
 * this is how we tell WSBC that we are hosting stuff
 * @param ws
 */
function refreshListings(ws: WebSocket){
	try{
		// send a ping frame
		ws.send(Buffer.from([0x9]));
		// send the actual listings
		const _services = wsClients[ws.url]?.services ?? [empty_service];
		ws.send(JSON.stringify(_services));
	} catch (err){
		console.error(err);
	}
}

/** i'm not dead yet */
function sendWsPing(ws: WebSocket){
	try{
		// send a ping frame
		ws.send(Buffer.from([0x9]));
	} catch (err){
		console.error(err);
	}
}

/** this is how we tell WSBC that we are hosting stuff */
function postListings(ws: WebSocket) {
	try {
		// send the actual listings
		const _services = wsClients[ws.url]?.services ?? [empty_service];
		ws.send(JSON.stringify(_services));
	} catch (err) {
		console.error(err);
	}
}

// --------------------------------------
// ----- websocket event listeners ------

import {WsEventData} from 'ProperNouns';

/** temporarily keep track of peer pairing info */
const socketMap: Map<string, UdpPair> = new Map();

async function onWsMessage (ev : MessageEvent) {
	try {
		// we shall open a udp socket and send something
		// to the specified address and port
		let ws = ev.target as WebSocket;
		//cog(ev.data);
		if (typeof ev.data === 'string') {
			const ev_data: WsEventData = JSON.parse(ev.data);
			const {request_id, flavour, wx} = ev_data;
			if (flavour === 'authn-ok'){
				// we authenticated ok, so now we can list our services
				refreshListings(ws);
				wsClients[ws.url]!.refreshTimer = setInterval(() => {
					refreshListings(ws);
				}, refreshTime);
			} else if (flavour === 'client-open' || flavour === 'server-open') {
				// WSBC (the game coordinator) wants us to reach out to someone
		
				// make some new UDP sockets
				const udp_pair = await createUdpPair(wx);

				// if we're using IPv4, then we can't actually tell WSBC
				// about our punch_port. That's the miracle of NAT, baby.
				if (!net.isIPv6(wx.remote_addr)){
					await new Promise<void>((resolve, reject)=>{
						let spontaneousDeath = setTimeout(function(){
							// timeout the effort after a few seconds, to prevent the process
							// from hanging
							reject();
						}, 8000);
						function prependOnce_onmessage(msg: Buffer, rinfo: dgram.RemoteInfo){
							// WSBC acknowledged our UDP port
							clearTimeout(spontaneousDeath);
							resolve();
						}
						udp_pair.punch_socket.prependOnceListener('message', prependOnce_onmessage);
						// send a ping to the grandFacade port
						udp_pair.punch_socket.send(Buffer.from(request_id), 39688, '4.waluigi-servebeer.com');
					}).catch(reason=>{
						// we don't really have to do much here
						console.error(reason);
					});
				}

				const punch_port = udp_pair.punch_socket.address().port;
			
				if (flavour === 'client-open') {
					// temporarily keep track of stuff
					socketMap.set(request_id, udp_pair);
					setTimeout(function(){
						socketMap.delete(request_id);
					}, 10000);
				} else if (flavour === 'server-open') {
					// associate this punch_socket with a remote client
					udp_pair.remote_info.port = wx.remote_port;
					udp_pair.remote_info.address = wx.remote_addr;
					// send an initial message
					udp_pair.ps_send(punchMsg);
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
					udp_pair.remote_info.port = wx.remote_port;
					udp_pair.remote_info.address = wx.remote_addr;
					// send an initial message
					udp_pair.ps_send(punchMsg);
					// alert user about punch success
					cog(`Ok cool.`);
					cog(`Now go back to your game and try to connect to 127.0.0.1`);
				}
			} else {
				// this shouldn't happen
			}
		
		} else {
			// probs a pong frame, so just ignore
		}
	} catch(err) {
		cog('something has gone horribly wrong.');
	}
}

import {CopiumOptions, Microplastics} from 'ProperNouns';
import os from 'node:os';
import {setTimeout as setTimeoutP} from 'node:timers/promises';

/** keep track of some copium trash */
const plasticMap: Map<string, Microplastics> = new Map();

async function onWsMessage_copium(ev: MessageEvent) {
	try {
		let ws = ev.target as WebSocket;
		if (typeof ev.data === 'string') {
			const ev_data: WsEventData = JSON.parse(ev.data);
			const {flavour} = ev_data;
			if (flavour === 'authn-ok') {
				// we are authenticated now
				sendWsPing(ws);
				postListings(ws); 
				wsClients[ws.url]!.refreshTimer = setInterval(() => {
					sendWsPing(ws);
				}, refreshTime);
			} else if (flavour === 'client-open' || flavour === 'server-open') {
				// WSBC wants us to socialize

				const {wx, request_id} = ev_data;

				const copium_options: CopiumOptions = {
					executablePath: `opm-data/copium${os.type() === 'Windows_NT' ? '.exe' : ''}`,
					isServerMode: postingAds,
					appPort: wx.app_port,
					coordHost: grandFacade_addr,
					coordPort: grandFacade_port,
					requestId: request_id
				};

				const detrius = spawn_copium(copium_options);

				// kiddo has to start up and then send a datagram to grandFacade.
				// That takes time, so we'll wait for him (just a smidge, tho).
				await setTimeoutP(2000);

				// We don't have to witness the miracle of NAT in this case,
				// because copium does that internally.

				if (flavour === 'client-open') {
					// temporarily track the trash
					plasticMap.set(request_id, detrius);
					setTimeout(function () {
						plasticMap.delete(request_id);
					}, 10000);
				} else if (flavour === 'server-open') {
					// we can actually try to talk to the client now
					detrius.pair_with_peer(wx.remote_addr, wx.remote_port);
				}

				// mostly the same as above
				const punch_port = 0;
				const wsbc_reply = {
					request_id,
					flavour,
					punch_port
				};
				ws.send(JSON.stringify(wsbc_reply));
			} else if (flavour === 'peer-punch-port') {
				// he gave you his insta
				const {wx, request_id} = ev_data;

				const detrius = plasticMap.get(request_id);
				if (typeof detrius !== 'undefined') {
					detrius.pair_with_peer(wx.remote_addr, wx.remote_port);
				} else {
					// detrius was undefined
				}
			} else {
				// this shouldn't happen
			}

		} else {
			// PING PONG
		}
	} catch (err) {
		cog('FAILURE TO COPE');
		cog(err);
	}
}

function onWsError (ev : Event) {
	let ws = ev.target as WebSocket;
	console.error(`[${ws.url}]`, ev);
}

var onWsMessage_actual = onWsMessage;

function onceWsClose(ev: CloseEvent){
	let ws = ev.target as WebSocket;

	cog(`[${ws.url}] closed: [code: ${ev.code}] [reason: ${ev.reason||'none'}] [clean: ${ev.wasClean}]`);

	ws.removeEventListener('message', onWsMessage_actual);
	ws.removeEventListener('error', onWsError);
	if (wsClients[ws.url]?.refreshTimer){		
		clearInterval(wsClients[ws.url]?.refreshTimer);
	}
	// and now we have to wait and see if the server goes back up
		cog(`[${ws.url}] attempting to cope...`);
		setTimeout(() => {
			reinit_websocket(ws);
		}, 4000);
}

function onceWsOpen (ev: Event) {
	let ws = ev.target as WebSocket;

	cog(`[${ws.url}] open`);

	ws.addEventListener('error', onWsError);
	ws.addEventListener('message', onWsMessage_actual);

	if (existsSync('opm-data/product-key.json')){
		// user has elected to authenticate with a product key
		try {
			const productkey = JSON.parse(astext('opm-data/product-key.json'));
			ws.send(JSON.stringify(productkey));
		} catch(err) {
			cog("Failure to read product key");
		}
	} else {
		// we need to send login info to the server,
		// but we can't do that with the default WebSocket constructor,
		// since it doesn't let us set our own headers
		ws.send(JSON.stringify({'Cookie': astext('opm-data/cookie.txt')}));
	}

}

// ================================================================================================
// ======================================== the udp stuff =========================================
// ================================================================================================

async function createUdpSocket (family : 'udp4' | 'udp6', options: dgram.BindOptions) {
	const socket = dgram.createSocket(family);
	let udp_info = ``;

	socket.on('error', onUdpSocketError);
	socket.once('close', function onceUdpClose() {
		cog(`udp socket closed on ${udp_info}`);
		socket.off('error', onUdpSocketError);
	});
	// prevent some kinda race condition
	const promise = new Promise<void>((resolve, reject) => {
		socket.once('listening', function onceUdpListening() {
			const address = socket.address();
			udp_info = `[${address.address}]:${address.port}`;
			cog(`udp socket listening on ${udp_info}`);
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

// -----------------------------------
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
	let factorio_dynamic_port = postingAds ? wx.app_port : 0 ;
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
	const punch_socket = await createUdpSocket(fam, {});
	
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
		punch_socket.close();
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

	/**punch_socket.connect() says `ENETUNREACH`, so we use this instead*/
	const remote_info: dgram.RemoteInfo = {
		address: wx.remote_addr,
		family: net.isIPv6(wx.remote_addr) ? 'IPv4' : 'IPv6',
		port: wx.remote_port,
		size: 0
	};

	// punch sending helper function
	const ps_send = (msg: Buffer) => {
		punch_socket.send(msg, remote_info.port, remote_info.address, (err, bytes)=>{
			if (err) cog('punch_socket', err);
		});
	}

	// keep the hole punched
	let PersistentKeepalive = setInterval(() => {
		ps_send(punchMsg);
	}, 25000);

	// give the audience what they want
	return {factorio_socket, punch_socket, remote_info, ps_send};
}

// ================================================================================================
// ============================================ COPIUM ============================================
// ================================================================================================
import {spawn} from "node:child_process";
import {pipeline} from 'node:stream/promises';

/** make sure that we actually have copium downloaded */
async function check_for_copium() {
	let excode = 0;
	const os_type = os.type();
	const os_machine = os.machine();
	const file_ext = os_type === 'Windows_NT'?'.exe':'';
	const copium_path = `opm-data/copium${file_ext}`;
	const copium_etag_path = `opm-data/copium-etag.txt`;
	const req_url = `https://waluigi-servebeer.com/dlc/copium/copium-${os_type}-${os_machine}${file_ext}`;

	// check for copium on disk
	if (!existsSync(copium_path) || !existsSync(copium_etag_path)) {
		// no copium on disk
		const res = await fetch(req_url);
		if (res.ok && res.body) {
			// response was fine

			// write copium binary to disk
			const writeMe = fs.createWriteStream(copium_path);
			await pipeline(res.body, writeMe);
			if (!file_ext){
				// Need some permissions, man.
				fs.chmodSync(copium_path, 0o755);
			}
			cog(`copium binary saved to ${copium_path}`);

			// write etag to disk
			const his_etag = res.headers.get('etag') ?? '';
			fs.writeFileSync(copium_etag_path, his_etag);
		} else {
			// invalid URL
			cog('fetch issue');
		}
	} else {
		// we have copium at home

		// check if this is the newest version
		const his_etag = (await fetch(req_url, {method: "HEAD"})).headers.get('etag')??'';
		const ondisk_etag = astext(copium_etag_path);
		if (his_etag === ondisk_etag) {
			// this copium is fresh
			cog(`using copium binary at ${copium_path}`);
			try {
				fs.accessSync(copium_path, fs.constants.X_OK);
			} catch (err) {
				cog(`copium binary at ${copium_path} is not executable`);
				if (!file_ext) {
					// Need some permissions, man.
					fs.chmodSync(copium_path, 0o755);
				}
			}
		} else {
			// your copium is stale, my guy.
			cog(`deleting stale copium binary at ${copium_path}`);
			fs.rmSync(copium_path);
			fs.rmSync(copium_etag_path);
			excode = 1;
		}
	}
	return excode;
}

const listenToKid = true;

/**returns: 
 * 1) a kiddo
 * 2) a function to pair with the remote
 * 3) a function to kill the kiddo*/
function spawn_copium(options: CopiumOptions): Microplastics {
	// Determine ports based on our Role

	/**this is 0 in server mode*/
	const bindPort = options.isServerMode ? "0" : options.appPort.toString();
	/**this is 0 in CLIENT MODE*/
	const targetPort = options.isServerMode ? options.appPort.toString() : "0";

	/** the copium child process*/
	const kiddo = spawn(options.executablePath, [
		bindPort,
		targetPort,
		options.coordHost,
		options.coordPort.toString(),
		options.requestId
	]);
	const piddo = kiddo.pid??0;
	console.log(`@${piddo} BIRTH as ${options.isServerMode ? 'SERVER' : 'CLIENT'}`);

	// listen for child process output
	function stdout_ondata(data: Buffer) {
		const output = data.toString();
		console.log(`@${piddo}:cout << ${output}`);
	}
	function stderr_ondata(data: Buffer) {
		console.error(`@${piddo}:cerr ${data.toString()}`);
	}
	if (listenToKid) {
		kiddo.stdout?.on('data', stdout_ondata);
		kiddo.stderr?.on('data', stderr_ondata);
	}

	/**delete the child process*/
	function kill_kiddo() {
		if (!kiddo.killed) {
			console.log(`@${piddo} DEATH`);
			kiddo.kill('SIGTERM');
		}
	}

	/**in case someone hits ctrl+c in the node.js window*/
	function sigintHandler() {
		kill_kiddo();
		process.exit();
	}

	// Attach them to the main Node.js process
	process.on('exit', kill_kiddo);
	process.on('SIGINT', sigintHandler);
	process.on('SIGTERM', sigintHandler);

	/** when the child process is closed */
	function rp_onclose(code: number | null) {
		console.log(`@${piddo} EXIT #${code}`);

		// remove listeners from the child process
		kiddo.removeAllListeners();
		kiddo.stdout?.removeAllListeners();
		kiddo.stderr?.removeAllListeners();
		kiddo.stdin?.removeAllListeners();

		// remove specific listeners from main node.js process
		process.removeListener('exit', kill_kiddo);
		process.removeListener('SIGINT', sigintHandler);
		process.removeListener('SIGTERM', sigintHandler);
	}
	kiddo.on('close', rp_onclose);

	/** tell the child process to make a new friend */
	function pair_with_peer(peerIp: string, peerPort: number) {
		if (!kiddo.stdin) {
			console.error(`@${piddo}:cin write fail`);
			kill_kiddo();
		} else {
			console.log(`@${piddo}:cin >> ${peerIp} ${peerPort}`);
			kiddo.stdin.write(`${peerIp} ${peerPort}\n`);
		}
	}

	/**here's your order, sir*/
	return {kiddo, pair_with_peer, kill_kiddo};
}

// ================================================================================================
// ====================================== final bit of setup ======================================
// ================================================================================================

async function init_real(){
	init_settings();
	if (settings.use_copium) {
		let need_copium = 1;
		do {
			need_copium = await check_for_copium();
		} while (need_copium);
	} else {
		cog(`not using copium binary, unfortunately`);
	}
	await init_login();
	init_ads();
	if (!settings.use_localhost){
		await determineRealStacks();
	}
	init_websockets();
}
init_real();

