// the usual gang of idiots
import * as path from "node:path";
import * as fs from "node:fs";
const astext = (x: string) => fs.readFileSync(path.normalize(x), { encoding: "utf8" });
const asnumber = (x: string) => Number(astext(x));
const cog = console.log;

// ===========================================================
// http server
import http from "node:http";
import net from "node:net";
import dgram from 'node:dgram';
const server = http.createServer({noDelay:true});

interface Punch {
	// the IP address for someone
	addr: string;
	// this is the port for the service that client wants to advertise (ex: 2302)
	port: number;
	// this is the port that we're gonna be punching (ex: 39420)
	punchPort : number;
	// this is the name of the server, for display purposes
	serviceName : string;
	// which way are we swingin'?
	flavor:'out'|'in'|'stop';
}

const sockets = new Map<number, dgram.Socket>();

let someInterval : NodeJS.Timeout | null = null;

server.on('request', async (req, res)=>{
	if (req.method === "POST") {
    req.setEncoding("utf8");
    let somedata = "";

		const ondata = (chunk:any)=>{
      somedata += chunk;
    };
    req.on("data", ondata);
		req.once('end', async ()=>{
			req.off('data', ondata);

			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.setHeader('Access-Control-Allow-Origin', '*');

			// do stuff with the data
			const punch:Punch = JSON.parse(somedata);
			cog(somedata);

			// do we need to make a new socket?
			let socketPort : number;
			let socket = sockets.get(punch.punchPort);
			if (typeof socket === 'undefined'){
				// no socket already, so we gotta make a new one
				const fam = net.isIPv6(punch.addr) ? 'udp6' : 'udp4';
				socket = await createSocket(fam, punch.punchPort);
				socketPort = socket.address().port;
				sockets.set(socketPort, socket);
			} else {
				// we already have a socket
				socketPort = socket.address().port;
			}

			if (punch.flavor === 'in') {
				// the customer just wants to know what our socket port is
				res.write(String(socketPort));

			} else if (punch.flavor === 'out'){
				// and now we gotta talk to someone outside the home
				someInterval = setInterval(()=>{
					tryToSend(socket, socketPort, punch.addr);
				}, 5000);
				res.write('OK');

			} else if (punch.flavor === 'stop') {
				// we want to stop everything
				if (someInterval) {
					clearInterval(someInterval);
				}
				socket.close();
				socket.off('error', onSocketError);
				socket.off('message', onSocketMessage);
				sockets.delete(socketPort);
				res.write('OK');
			}
			
			// give the customer back a response
			res.end();
		});
	} else {
		res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end('sorry nothing');
	}
});

const httpPort = 39111;
server.once('listening',()=>{
	cog(`listen http on ${httpPort}`);
});
server.listen(httpPort, 'localhost');

// ==================================================================
// actually gotta talk to the waluigi-servebeer.com server for a sec
// authorization and authentication and all that
import https from 'node:https';
const useLocalhost = fs.existsSync('notkeys/use-localhost.txt')&&Boolean(asnumber('notkeys/use-localhost.txt'));
const useHostname = useLocalhost ? 'localhost' : 'waluigi-servebeer.com';
const http_request = useLocalhost ? http.request : https.request;

// try to log in with cookie, if we have one.
// failing that, log in with email and password
if (fs.existsSync('notkeys/cookie.txt')) {
	loginWithCookie();
} else {
	loginWithUserCredentials();
}

// we actually *do* have a cookie, so let's try to use that instead
function loginWithCookie(){
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
			loginWithUserCredentials();
		}
		// we honestly don't care about the rest of it

	});
	loginReq.end();
}


// we dont have a cookie, so we need to log in and then get the cookie
function loginWithUserCredentials(){
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
		});
	});

	loginReq.once('error', err=>{
		console.error(err);
	});
	loginReq.write(loginBody);
	loginReq.end();
}

// ============================================================
// the udp stuff

async function createSocket (family : 'udp4' | 'udp6', bindPort = 0) {
	const socket = dgram.createSocket(family);

	socket.on('error', onSocketError);
	socket.on('message', onSocketMessage);
	socket.once('close', onceSocketClose);
	// prevent some kinda race condition
	const promise = new Promise<dgram.Socket>((resolve, reject) => {
		socket.once('listening', () => {
			onceSocketListening(socket);
			resolve(socket);
		});
	});

	socket.bind(bindPort);
	await promise;

	return socket;
}

function onceSocketListening(socket: dgram.Socket){
	const address = socket.address();
	cog(`udp socket listening on ${address.address},${address.port}`);
}

function onSocketError (err : Error) {
	console.error(`socket error: ${err}`);
}

function onSocketMessage (msg : Buffer, rinfo : dgram.RemoteInfo) {	
	cog(`we got ${msg} from ${rinfo.address},${rinfo.port}`);
}

function onceSocketClose () {
	cog(`socket closed`);
}

function tryToSend(socket: dgram.Socket, destPort: number, destAddr: string){
	try{
		const sayWhat = Math.random().toString().padEnd(20, '0');
		socket.send(sayWhat, destPort, destAddr, (err, bytes)=>{
			if (err){
				cog(`error`, err);
			} else {
				cog(`sending ${sayWhat} to ${destAddr},${destPort}`);
			}
		});
	} catch(err){
		console.error(`error`, err);
	}
}

//const ImDoingMyPart = () => tryToSend(theRemotePort, theRemoteAddress);

//setInterval(ImDoingMyPart, 2000);
