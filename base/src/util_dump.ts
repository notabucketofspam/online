import fs from "node:fs";
import path from "node:path";
export function astext(x: string) {
    return fs.readFileSync(path.normalize(x), { encoding: "utf8" });
}
