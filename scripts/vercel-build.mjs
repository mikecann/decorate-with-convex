import { spawnSync } from "node:child_process";

const production = process.env.VERCEL_ENV === "production";
const env = { ...process.env };

if (!production) {
  // A production deploy key must never deploy a backend from a PR build.
  // Previews use our existing development backend unless explicitly configured.
  env.VITE_CONVEX_URL ||= "https://rare-grouse-703.convex.cloud";
  delete env.CONVEX_DEPLOY_KEY;
}

const command = production ? "./node_modules/.bin/convex" : "npm";
const args = production
  ? ["deploy", "--yes", "--cmd", "npm run build"]
  : ["run", "build"];
const result = spawnSync(command, args, { env, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
