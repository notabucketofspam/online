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

interface Punch {
	/**the IP address for someone */
	addr: string;
	/** this is the port for the service that client wants to advertise (ex: 2302) */
	port: number;
	/**this is the name of the server, for display purposes */
	serviceName : string;
	/**Who posted this?*/
	username: string;
}

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
const wsProtocol = useLocalhost ? 'ws' : 'wss';
/**will probably be IPv6 */
let wsClient6: WebSocket;


/** will be IPv4 or unused */
let wsClient4: WebSocket;


let wsUrlJr = `${wsProtocol}://6.${useHostname}/wss`;
const wsClients = {

};

const refreshTime = 10000;
let wsRefreshTimer: NodeJS.Timeout;
function refreshListings(){
	try{
		// send a ping frame
		wsClient6.send(Buffer.from([0x9]));
		// send the actual listings
		wsClient6.send(JSON.stringify(services));
	} catch (err){
		console.error(err);
	}
}
function init_websocket(){
	let wsUrl = `${wsProtocol}://${useHostname}/wss`;
	if (!useLocalhost){
		wsUrl = `${wsProtocol}://4.${useHostname}/wss`;
		let wsUrlJr = `${wsProtocol}://6.${useHostname}/wss`;
		wsClient4 = new WebSocket(wsUrlJr);
		wsClient4.addEventListener('close', onceWsClose, {once:true});
		wsClient4.addEventListener('open', onceWsOpen, {once:true});
	}
	//cog(wsUrl);
	wsClient6 = new WebSocket(wsUrl);
	wsClient6.addEventListener('close', onceWsClose, {once:true});
	wsClient6.addEventListener('open', onceWsOpen, {once:true});
}

// -------------------------------------- websocket event listeners

async function onWsMessage (ev : MessageEvent) {
	// we shall open a udp socket and send something
	// to the specified address and port
	cog(ev.data);
	if (typeof ev.data === 'string') {
		// the server wants us to reach out to someone
		const punch = JSON.parse(ev.data) as Punch;

		// make a new UDP socket
		const fam = net.isIPv6(punch.addr) ? 'udp6' : 'udp4';
		const socket = await createUdpSocket(fam);

		// send messages to the other person
		let timer_wah : NodeJS.Timeout | null = null;
		timer_wah = setInterval(() => {
			socket.send('', punch.port, punch.addr, (err, bytes)=>{
				if (err) {
					cog(err);
				} else {
					// we still dont care tbh
				}
			});
		}, 1000);

		// ... but we dont wanna do that *forever*, tho
		setTimeout(() => {
			if (timer_wah) {
				clearTimeout(timer_wah);
			}
			if (socket){
				socket.close();
			}
		}, 15000);

	} else {
		// probs a pong frame, so just ignore
	}
}

function onWsError (ev : Event) {
	console.error('ws error', ev);
}

let wsCopiumTimer: NodeJS.Timeout;
function onceWsClose(ev: CloseEvent){
	let ws = ev.target as WebSocket;
	cog('ws closed', `[code: ${ev.code}]`, `[reason: ${ev.reason}]`, `[clean? ${ev.wasClean}]`);
	ws.removeEventListener('message', onWsMessage);
	ws.removeEventListener('error', onWsError);
	if (wsRefreshTimer){		
		clearInterval(wsRefreshTimer);
	}
	// and now we have to wait and see if the server goes back up
	wsCopiumTimer = setInterval(() =>{
		ws.removeEventListener('open', onceWsOpen);
		ws.removeEventListener('close', onceWsClose);
		cog('attempting to cope...');
		init_websocket();
	}, 10000);
}

function onceWsOpen (ev: Event) {
	cog('ws open');
	let ws = ev.target as WebSocket;
	ws.addEventListener('error', onWsError);
	ws.addEventListener('message', onWsMessage);
	ws.send(JSON.stringify({'Cookie': astext('notkeys/cookie.txt')}));
	refreshListings();
	wsRefreshTimer = setInterval(refreshListings, refreshTime);
	if (wsCopiumTimer!) {
		clearTimeout(wsCopiumTimer);
	}
}


// ============================================================
// the udp stuff

async function createUdpSocket (family : 'udp4' | 'udp6') {
	const socket = dgram.createSocket(family);

	socket.on('error', onUdpSocketError);
	socket.once('close', function () {
		cog(`socket closed`);
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

	socket.bind();
	await promise;

	return socket;
}

function onUdpSocketError (err : Error) {
	console.error(`socket error: ${err}`);
}

// ============================================================
// final bit of setup
async function init_real(){
	await init_login();
	init_websocket();
}
init_real();

