import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");

const processes = [
  spawn(process.execPath, ["server/index.mjs"], {
    env: { ...process.env, PORT: "3001" },
    cwd: rootDir,
    stdio: "inherit"
  }),
  spawn(process.execPath, [viteBin, "--host", "127.0.0.1"], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  })
];

let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const childProcess of processes) {
    if (!childProcess.killed) {
      childProcess.kill();
    }
  }
  process.exit(exitCode);
}

for (const childProcess of processes) {
  childProcess.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      stopAll(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
