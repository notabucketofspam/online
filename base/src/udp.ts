import dgram from 'node:dgram';
import {punchJoinMap as joinMap} from "./express_app";

const udpOK = Buffer.from('PUNCH');

export function grandFacade(){
	const socket = dgram.createSocket({type: 'udp4'}, (msg, rinfo)=>{
		try{
			const request_id = msg.toString();
			const wsPair = joinMap.get(request_id);
			if (typeof wsPair !== 'undefined'){
				const {wsMeta} = wsPair;
				const address = rinfo.address;
				if (address === wsMeta.server_addr){
					// the server has pinged us using UDP
					wsMeta.server_port = rinfo.port;
				} else {
					// I'm just gonna assume that this is the client
					wsMeta.client_port = rinfo.port;
				}
				socket.send(udpOK, rinfo.port, rinfo.address);
			} else {
				// wsPair is undefined
				// ignore the request
			}
		} catch(err){}
	});
	socket.bind({port:39688});
}
