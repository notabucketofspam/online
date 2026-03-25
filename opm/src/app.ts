import dgram from 'node:dgram';

const cog = console.log;

const socket = dgram.createSocket('udp6');

socket.on('listening', ()=>{
	const address = socket.address();
	cog(`socket listening: address is ${address.address} and port is ${address.port}`);
});

socket.on('connect', ()=>{
	const remote = socket.remoteAddress();
	cog(`connect ${remote.address} with port ${remote.port}`);
});

socket.on('message', (msg, rinfo)=>{
	cog(`we got ${msg} from ${rinfo.address}:${rinfo.port}`);
});

function tryToSend(port: number, address: string){
	socket.send(Math.random().toString(), port, address, (err, bytes)=>{
		if (err){
			cog(`error`, err);
		} else {
			cog(`ok`, bytes);
		}
	});
}

const ImDoingMyPart = () => tryToSend(39111, 'nothing');

setInterval(ImDoingMyPart, 300);

socket.bind(39111);
