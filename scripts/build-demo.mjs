import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = path.join(root, "node_modules", "vite", "bin", "vite.js");
const result = spawnSync(process.execPath, [vite, "build", "--base", "/gym-management-system/"], {
  cwd: root,
  env: { ...process.env, VITE_DEMO_MODE: "true" },
  stdio: "inherit"
});

process.exit(result.status ?? 1);
