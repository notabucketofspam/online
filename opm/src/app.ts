// the usual gang of idiots
import * as path from "node:path";
import * as fs from "node:fs";
const astext = (x: string) => fs.readFileSync(path.normalize(x), { encoding: "utf8" });
const asnumber = (x: string) => Number(astext(x));
const cog = console.log;

import dgram from 'node:dgram';
const socket = dgram.createSocket('udp6');

socket.on('listening', ()=>{
	const address = socket.address();
	cog(`listening [${address.address}]:${address.port}`);
});

socket.on('message', (msg, rinfo)=>{
	cog(`we got ${msg} from [${rinfo.address}]:${rinfo.port}`);
});

function tryToSend(port: number, address: string){
	const sayWhat = Math.random().toString().padEnd(19, '0');
	socket.send(sayWhat, port, address, (err, bytes)=>{
		if (err){
			cog(`error`, err);
		} else {
			cog(`sending ${sayWhat} to [${address}]:${port}`);
		}
	});
}

// for the purposes of this video, we're gonna use some predefined stuffs
const theRemotePort = asnumber("notkeys/remote_port.txt");
const theRemoteAddress = astext("notkeys/remote_addr.txt");

const ImDoingMyPart = () => tryToSend(theRemotePort, theRemoteAddress);

const theListenPort = asnumber("notkeys/listen_port.txt");
socket.bind(theListenPort);

setInterval(ImDoingMyPart, 300);
