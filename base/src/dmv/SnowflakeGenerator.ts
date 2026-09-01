/**thanks, gemini*/
export class SnowflakeGenerator {
  // Epoch: January 1, 2026, 00:00:00 UTC
  // new Date('2026-01-01T00:00:00.000Z').getTime()
  private static readonly EPOCH = 1767225600000n;

  // Bit distribution
  private static readonly WORKER_BITS = 5n;
  private static readonly SEQUENCE_BITS = 7n;

  // Max values to prevent overflow
  private static readonly MAX_WORKER_ID = (1n << this.WORKER_BITS) - 1n; // 31
  private static readonly MAX_SEQUENCE = (1n << this.SEQUENCE_BITS) - 1n; // 127

  // Bit shifts
  private static readonly WORKER_SHIFT = this.SEQUENCE_BITS; // 7
  private static readonly TIMESTAMP_SHIFT = this.SEQUENCE_BITS + this.WORKER_BITS; // 12

  private workerId: bigint;
  private sequence: bigint = 0n;
  private lastTimestamp: bigint = -1n;

  /**
   * @param workerId Must be a unique integer between 0 and 31 for each worker process
   */
  constructor(workerId: number) {
    const id = BigInt(workerId);
    if (id < 0n || id > SnowflakeGenerator.MAX_WORKER_ID) {
      throw new Error(`Worker ID must be between 0 and ${SnowflakeGenerator.MAX_WORKER_ID}`);
    }
    this.workerId = id;
  }

  private currentTimestamp(): bigint {
    return BigInt(Date.now());
  }

  public nextId(): number {
    let timestamp = this.currentTimestamp();

    if (timestamp < this.lastTimestamp) {
      throw new Error("System clock moved backwards. Refusing to generate ID.");
    }

    if (timestamp === this.lastTimestamp) {
      // Same millisecond: increment the sequence
      this.sequence = (this.sequence + 1n) & SnowflakeGenerator.MAX_SEQUENCE;

      if (this.sequence === 0n) {
        // Sequence hit 128 and overflowed to 0. We must wait for the next millisecond.
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      // New millisecond: reset sequence to 0
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    // Calculate milliseconds since our 2026 custom epoch
    const timeSinceEpoch = timestamp - SnowflakeGenerator.EPOCH;

    // Shift and combine the bits
    const id = (timeSinceEpoch << SnowflakeGenerator.TIMESTAMP_SHIFT) |
               (this.workerId << SnowflakeGenerator.WORKER_SHIFT) |
               this.sequence;

    // Cast back to a standard JS Number (safe because max bits is 53)
    return Number(id);
  }

  /**
   * Blocks execution until the next millisecond ticks over.
   */
  private waitNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.currentTimestamp();
    while (timestamp <= lastTimestamp) {
      timestamp = this.currentTimestamp();
    }
    return timestamp;
  }
}
