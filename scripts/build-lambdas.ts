// Bundles each Lambda entry point into api/dist/<name>/index.mjs (track A section 7, "Bundling the agent").
// SAM then deploys these folders directly: run `sam deploy` without `sam build`.
// npx tsx scripts/build-lambdas.ts [names...]
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const API = join(dirname(fileURLToPath(import.meta.url)), '..', 'api');
const ALL = ['api', 'agent', 'ingest', 'verify', 'workflow'];
const names = process.argv.slice(2).length ? process.argv.slice(2) : ALL.filter((n) => existsSync(join(API, 'src', 'lambda', `${n}.ts`)));

for (const name of names) {
  const outdir = join(API, 'dist', name);
  rmSync(outdir, { recursive: true, force: true });
  const r = await build({
    entryPoints: { index: join(API, 'src', 'lambda', `${name}.ts`) },
    outdir,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outExtension: { '.js': '.mjs' },
    // The nodejs22.x runtime ships AWS SDK v3
    external: ['@aws-sdk/*'],
    banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
    sourcemap: 'inline',
    metafile: true,
    logLevel: 'warning',
  });
  const bytes = Object.values(r.metafile.outputs).reduce((a, o) => a + o.bytes, 0);
  console.log(`built ${name.padEnd(8)} -> api/dist/${name}/index.mjs (${(bytes / 1024).toFixed(0)} KB)`);
}
