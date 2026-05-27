import fs from "node:fs";
import path from "node:path";

const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", "..", ".env"),
  path.resolve(process.cwd(), "..", ".env")
];

for (const filePath of candidates) {
  if (!fs.existsSync(filePath)) continue;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsAt = trimmed.indexOf("=");
    if (equalsAt === -1) continue;

    const key = trimmed.slice(0, equalsAt).trim();
    let value = trimmed.slice(equalsAt + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
  break;
}
