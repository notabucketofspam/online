import dgram from 'node:dgram';
import {punchJoinMap as joinMap} from "./punch";
import {WsPairMeta} from "VocabQuiz";

const udpOK = Buffer.from('PUNCH');

type relaysocket_t = { IPv4 : dgram.Socket, IPv6 : dgram.Socket };
const relaySocket : relaysocket_t = {} as relaysocket_t;

// know these port numbers elsewhere in the program
const rsPort = {
	IPv4: 39684,
	IPv6: 39686
};

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

	relaySocket.IPv4 = dgram.createSocket({type: 'udp4'});
	relaySocket.IPv4.bind({port: rsPort.IPv4});
	relaySocket.IPv6 = dgram.createSocket({ type: 'udp6' });
	relaySocket.IPv6.bind({ port: rsPort.IPv6});
}


export function theWsbcUdpRelay(pm: WsPairMeta){
	try{
		function end_this_madness(){
			relaySocket.IPv4.removeListener('message', relay_onmessage );
			relaySocket.IPv6.removeListener('message', relay_onmessage );
		}

		// I'm not dead yet
		let DeathTimer = setTimeout(end_this_madness, 60000);

		function relay_onmessage (msg : Buffer, rinfo : dgram.RemoteInfo) {

			// need to determine where to forward our mail to
			if (rinfo.address === pm.client_addr && rinfo.port === pm.client_port) {
				// this is the client speaking, so we gotta send it to the server
				relaySocket[ rinfo.family ].send(msg, pm.server_port, pm.server_addr);
				DeathTimer.refresh();
			} else if (rinfo.address === pm.server_addr && rinfo.port === pm.server_port ){
				// the server speaks!
				relaySocket[ rinfo.family ].send(msg, pm.client_port, pm.client_addr);
				DeathTimer.refresh();
			} else {
				// idk who this is, so ignore
			}
		}

		relaySocket.IPv4.addListener('message', relay_onmessage );
		relaySocket.IPv6.addListener('message', relay_onmessage );

	} catch (err) {
		
	}
}


export {rsPort};
