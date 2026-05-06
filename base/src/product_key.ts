/**
 * generate a very real Microsoft product key
 * @returns 
 */
export function generateMSProductKey() {
  const ALPHABET = "BCDFGHJKMPQRTVWXY2346789";
  const BASE = BigInt(ALPHABET.length);

  // The maximum possible value for a 25-digit base-24 number
  const maxVal = BASE ** 25n;

  // The maximum possible value for 120 bits
  const max120Bits = 2n ** 120n;

  // Calculate the 'fair' limit to prevent modulo bias
  // This chops off the uneven remainder at the very top of the 120-bit range
  const unbiasedLimit = max120Bits - (max120Bits % maxVal);

  const bytes = new Uint8Array(15);
  let num;

  // REJECTION SAMPLING:
  // Keep generating random bytes until we get a number strictly below the unbiased limit.
  do {
    crypto.getRandomValues(bytes);
    num = 0n;
    for (let i = 0; i < bytes.length; i++) {
      num = (num << 8n) | BigInt(bytes[i]!);
    }
  } while (num >= unbiasedLimit);

  // Now it is perfectly safe and unbiased to use modulo
  num = num % maxVal;

  let keyString = "";
  for (let i = 0; i < 25; i++) {
    let remainder = Number(num % BASE);
    keyString = ALPHABET[remainder] + keyString;
    num = num / BASE;
  }

  const parts = [];
  for (let i = 0; i < 25; i += 5) {
    parts.push(keyString.substring(i, i + 5));
  }

  return parts.join("-");
  // thanks gemini
}

