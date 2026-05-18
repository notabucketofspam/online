import {spawn, ChildProcess} from 'node:child_process';

// Strongly typed configuration parameters
export interface RelayOptions {
  executablePath: string;
  isServerMode: boolean;
  appPort: number;
  coordHost: string;
  coordPort: number;
  requestId: string;
}

// The interactive reference object returned to your main app
export interface RelayInstance {
  /** The raw underlying Node child process */
  relayProcess: ChildProcess;
  /** Call this when your STUN/Coordinator server finds the peer */
  pairWithPeer: (peerIp: string, peerPort: number) => void;
  /** Safely terminate the C++ background process */
  selfDestruct: () => void;
}

/**
 * Spawns and manages the C++ UDP Hole-Punching Relay
 */
export function createUdpRelay(options: RelayOptions): RelayInstance {
  // Determine ports based on our Role (Server vs Client)
  const bindPort = options.isServerMode ? "0" : options.appPort.toString();
  const targetPort = options.isServerMode ? options.appPort.toString() : "0";
  // create the child process
  const relayProcess = spawn(options.executablePath, [
    bindPort,
    targetPort,
    options.coordHost,
    options.coordPort.toString(),
    options.requestId
  ]);
  console.log(`[RelayManager] Spawned worker (PID: ${relayProcess.pid}) in ${options.isServerMode ? 'Server' : 'Client'} mode.`);

  /**
   * listen for when the child speaks
   * @param data
   */
  function stdout_ondata(data: Buffer) {
    const output = data.toString().trim();
    console.log(`[C++] ${output}`);
    if (output.startsWith('READY:')) {
      const assignedPort = parseInt(output.split(':')[1] ?? '0', 10);
      console.log(`[RelayManager] Relay bound to local port: ${assignedPort}`);
    }
  }
  relayProcess.stdout?.addListener('data', stdout_ondata);

  /**
   * listen for when the child complains loudly in public
   * @param data
   */
  function stderr_ondata(data: Buffer) {
    console.error(`[C++ ERR] ${data.toString().trim()}`);
  }
  relayProcess.stderr?.addListener('data', stderr_ondata);

  /**delete the child process*/
  function selfDestruct() {
    if (!relayProcess.killed) {
      console.log(`[RelayManager] Parent terminating. Taking C++ worker down with it...`);
      relayProcess.kill('SIGTERM');
    }
  }

  /**in case someone hits ctrl+c in the node.js window*/
  function sigintHandler() {
    selfDestruct();
    process.exit();
  }

  // Attach them to the main Node.js process
  process.on('exit', selfDestruct);
  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigintHandler);

  /**
   * when the child process is closed
   * @param code
   */
  function rp_onclose(code: number | null)  {
    console.log(`[RelayManager] Worker exited with code ${code}`);

    // 1. Strip all listeners from the dead child process
    relayProcess.removeAllListeners();
    relayProcess.stdout?.removeAllListeners();
    relayProcess.stderr?.removeAllListeners();
    relayProcess.stdin?.removeAllListeners();

    // 2. Detach the destruct handlers from the main Node process to prevent memory leaks!
    process.removeListener('exit', selfDestruct);
    process.removeListener('SIGINT', sigintHandler);
    process.removeListener('SIGTERM', sigintHandler);

    console.log(`[RelayManager] Memory and event listeners successfully wiped.`);
  }
  relayProcess.on('close', rp_onclose);

  /**
   * tell the child process to make a new friend
   * @param peerIp
   * @param peerPort
   */
  function pairWithPeer(peerIp: string, peerPort: number) {
    if (!relayProcess.stdin) {
      console.error("[RelayManager] Error: Cannot write to C++ stdin.");
      selfDestruct();
    } else {
      console.log(`[RelayManager] Piping peer info to C++ -> ${peerIp}:${peerPort}`);
      relayProcess.stdin.write(`${peerIp} ${peerPort}\n`);
    }
  }

  /**here's your order, sir*/
  return {
    relayProcess,
    pairWithPeer,
    selfDestruct    
  };
}

