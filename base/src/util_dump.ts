import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export function astext(x: string) {
  return fs.readFileSync(path.normalize(x), {encoding: "utf8"});
}
export function rember<T>(arr: T[]): T {
  return arr[crypto.randomInt(arr.length)]!;
}
