import dgram from 'node:dgram';
import {punchJoinMap as joinMap} from "./punch";
import {WsPairMeta} from "VocabQuiz";

const udpOK = Buffer.from('PUNCH');

let relaySocket : dgram.Socket;
export const rsPort = 39688;

export function grandFacade(){
	// leave this as udp4 for now, because some people don't have IPv6
	const socket = dgram.createSocket({type: 'udp4'}, (msg, rinfo)=>{
		try{
			const request_id = msg.toString();
			const wsPair = joinMap.get(request_id);
			if (typeof wsPair !== 'undefined'){
				// const {wsMeta} = wsPair;
				// console.log('grandFacade', rinfo);
				const address = rinfo.address;
				if (address === wsPair.wsMeta.server_addr){
					// the server has pinged us using UDP
					wsPair.wsMeta.server_port = rinfo.port;
				} else {
					// I'm just gonna assume that this is the client
					wsPair.wsMeta.client_port = rinfo.port;
				}
				socket.send(udpOK, rinfo.port, rinfo.address);
			} else {
				// wsPair is undefined
				// ignore the request
				socket.send(rinfo.address + ' ' + rinfo.port, rinfo.port, rinfo.address);
			}
		} catch(err){}
	});
	socket.bind({port:rsPort});

	relaySocket = socket;
}

export function theWsbcUdpRelay(pm: WsPairMeta){
	// console.log(pm);
	try{
		function end_this_madness(){
			relaySocket.removeListener('message', relay_onmessage );
		}

		// I'm not dead yet
		let DeathTimer = setTimeout(end_this_madness, 60000);

		function relay_onmessage (msg : Buffer, rinfo : dgram.RemoteInfo) {
			// console.log(rinfo);
			try{
				// need to determine where to forward our mail to
				if (rinfo.address === pm.client_addr && rinfo.port === pm.client_port) {
					// this is the client speaking, so we gotta send it to the server
					relaySocket.send(msg, pm.server_port, pm.server_addr);
					DeathTimer.refresh();
				} else if (rinfo.address === pm.server_addr && rinfo.port === pm.server_port ){
					// the server speaks!
					relaySocket.send(msg, pm.client_port, pm.client_addr);
					DeathTimer.refresh();
				} else {
					// idk who this is, so ignore
				}
			} catch(err) {

			}
		}

		relaySocket.addListener('message', relay_onmessage );

	} catch (err) {
		console.log(err);
	}
}

