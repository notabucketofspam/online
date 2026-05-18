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
  process: ChildProcess;
  /** Call this when your STUN/Coordinator server finds the peer */
  pairWithPeer: (peerIp: string, peerPort: number) => void;
  /** Safely terminate the C++ background process */
  kill: () => void;
}

/**
 * Spawns and manages the C++ UDP Hole-Punching Relay
 */
export function createUdpRelay(options: RelayOptions): RelayInstance {
  // Determine ports based on our Role (Server vs Client)
  const bindPort = options.isServerMode ? "0" : options.appPort.toString();
  const targetPort = options.isServerMode ? options.appPort.toString() : "0";

  const relayProcess = spawn(options.executablePath, [
    bindPort,
    targetPort,
    options.coordHost,
    options.coordPort.toString(),
    options.requestId
  ]);

  console.log(`[RelayManager] Spawned worker (PID: ${relayProcess.pid}) in ${options.isServerMode ? 'Server' : 'Client'} mode.`);

  // --- Standard Output Listeners ---

  relayProcess.stdout?.on('data', (data: Buffer) => {
    const output = data.toString().trim();
    console.log(`[C++] ${output}`);

    if (output.startsWith('READY:')) {
      const assignedPort = parseInt(output.split(':')[1]??'0', 10);
      console.log(`[RelayManager] Relay bound to local port: ${assignedPort}`);
    }
  });

  relayProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[C++ ERR] ${data.toString().trim()}`);
  });

  // --- PARENT PROCESS CLEANUP LOGIC ---
  // We define these here so they exist before the 'close' event needs to remove them.

  const selfDestruct = () => {
    if (!relayProcess.killed) {
      console.log(`[RelayManager] Parent terminating. Taking C++ worker down with it...`);
      relayProcess.kill('SIGTERM');
    }
  };

  const sigintHandler = () => {selfDestruct(); process.exit();};
  const sigtermHandler = () => {selfDestruct(); process.exit();};

  // Attach them to the main Node.js process
  process.on('exit', selfDestruct);
  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);

  // --- CHILD PROCESS CLEANUP LOGIC ---

  relayProcess.on('close', (code: number | null) => {
    console.log(`[RelayManager] Worker exited with code ${code}`);

    // 1. Strip all listeners from the dead child process
    relayProcess.removeAllListeners();
    relayProcess.stdout?.removeAllListeners();
    relayProcess.stderr?.removeAllListeners();
    relayProcess.stdin?.removeAllListeners();

    // 2. Detach the destruct handlers from the main Node process to prevent memory leaks!
    process.removeListener('exit', selfDestruct);
    process.removeListener('SIGINT', sigintHandler);
    process.removeListener('SIGTERM', sigtermHandler);

    console.log(`[RelayManager] Memory and event listeners successfully wiped.`);
  });

  // --- Return the Interactive Controller ---

  return {
    process: relayProcess,

    pairWithPeer: (peerIp: string, peerPort: number) => {
      if (!relayProcess.stdin) {
        console.error("[RelayManager] Error: Cannot write to C++ stdin.");
        return;
      }
      console.log(`[RelayManager] Piping peer info to C++ -> ${peerIp}:${peerPort}`);
      relayProcess.stdin.write(`${peerIp} ${peerPort}\n`);
    },

    kill: () => {
      selfDestruct();
    }
  };
}

