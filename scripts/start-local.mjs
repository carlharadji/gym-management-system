import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");

await ensureRunning({
  name: "API",
  url: "http://127.0.0.1:3001/api/members",
  command: process.execPath,
  args: ["server/index.mjs"],
  outLog: "dev-server.api.out.log",
  errLog: "dev-server.api.err.log"
});

await ensureRunning({
  name: "client",
  url: "http://127.0.0.1:5173/",
  command: process.execPath,
  args: [viteBin, "--host", "127.0.0.1"],
  outLog: "dev-server.client.out.log",
  errLog: "dev-server.client.err.log"
});

console.log("Local app ready:");
console.log("Website: http://127.0.0.1:5173/");
console.log("API:     http://127.0.0.1:3001/api/members");

async function ensureRunning(target) {
  if (await isOk(target.url)) {
    console.log(`${target.name} already running.`);
    return;
  }

  const out = openSync(path.join(rootDir, target.outLog), "a");
  const err = openSync(path.join(rootDir, target.errLog), "a");
  const child = spawn(target.command, target.args, {
    cwd: rootDir,
    detached: true,
    stdio: ["ignore", out, err],
    windowsHide: true
  });

  child.unref();

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await isOk(target.url)) {
      console.log(`Started ${target.name} server.`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`${target.name} server did not become ready in time. Check ${target.errLog}.`);
}

async function isOk(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}
