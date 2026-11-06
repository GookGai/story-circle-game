import { spawnSync } from 'node:child_process';
import { PRODUCTION_URL } from '../src/utils/appLinks.mjs';

// Use the current Node executable so the CLI also works on machines with multiple Node versions.
for (const args of [['node_modules/vite/bin/vite.js', 'build'], ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']]) {
  const result = spawnSync(process.execPath, args, { cwd: new URL('..', import.meta.url), stdio: 'inherit', env: { ...process.env, VITE_API_URL: PRODUCTION_URL } });
  if (result.status !== 0) process.exit(result.status || 1);
}
