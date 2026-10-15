// Next's standalone server needs its public and static assets copied alongside
// the traced server. Keep npm start and the Docker image consistent.
import { cp, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(project, ".next", "standalone");
const server = join(standalone, "server.js");
try {
  await access(server);
} catch {
  throw new Error("Run npm run build before npm start.");
}
await cp(join(project, "public"), join(standalone, "public"), {
  recursive: true,
});
await cp(
  join(project, ".next", "static"),
  join(standalone, ".next", "static"),
  { recursive: true },
);
const args = process.argv.slice(2);
const portIndex = args.findIndex(
  (value) => value === "--port" || value === "-p",
);
const port = portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || "3000";
if (!/^\d+$/.test(port || "") || Number(port) < 1 || Number(port) > 65535)
  throw new Error("Choose a port between 1 and 65535.");
process.env.PORT = port;
process.env.HOSTNAME ||= "127.0.0.1";
await import(pathToFileURL(server).href);
