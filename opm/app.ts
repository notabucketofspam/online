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
