#!/usr/bin/env node
// The publish check: packs @haeckmec/grounded-chat, copies examples/grounded-kb to a temporary
// directory outside the workspace, installs the tarball there as an outside app would, then runs the
// example's typecheck, tests and scripted conversation against it. Exits non-zero on any failure.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

const work = mkdtempSync(join(tmpdir(), 'grounded-kb-packed-'));
run('npx', ['turbo', 'run', 'build', '--filter=@haeckmec/grounded-chat'], root);
run('npm', ['pack', '--pack-destination', work], join(root, 'packages/grounded-chat'));
const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'));
if (!tarball) throw new Error('npm pack produced no tarball');

const app = join(work, 'grounded-kb');
cpSync(join(root, 'examples/grounded-kb'), app, { recursive: true, filter: (src) => !/node_modules|dist/.test(src) });
const pkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
pkg.dependencies['@haeckmec/grounded-chat'] = `file:../${tarball}`;
// The shared lint config is a private workspace package; the outside copy skips lint.
delete pkg.devDependencies['@haeckmec/eslint-config'];
delete pkg.scripts.lint;
writeFileSync(join(app, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
const tsconfig = JSON.parse(readFileSync(join(app, 'tsconfig.json'), 'utf8'));
tsconfig.extends = undefined;
tsconfig.compilerOptions = { ...JSON.parse(readFileSync(join(root, 'tsconfig.base.json'), 'utf8')).compilerOptions, ...tsconfig.compilerOptions };
writeFileSync(join(app, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);

run('npm', ['install', '--no-audit', '--no-fund'], app);
run('npx', ['tsc', '--noEmit'], app);
run('npx', ['vitest', 'run'], app);
run('npx', ['tsx', 'scripts/conversation.ts'], app);
process.stdout.write(`\nThe example ran on ${tarball} from ${work}.\n`);
