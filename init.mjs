#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HOOK_LINE = 'npx strip-clanker-attribution "$1"';

function gitRoot() {
    try {
        return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}

function main() {
    const root = gitRoot();
    if (!root) {
        console.error('Not inside a git repository.');
        process.exit(1);
    }

    const huskyDir = join(root, '.husky');
    if (!existsSync(huskyDir)) {
        console.error('No .husky directory found. Set up husky first: npx husky init');
        process.exit(1);
    }

    const hookFile = join(huskyDir, 'commit-msg');
    if (existsSync(hookFile)) {
        const content = readFileSync(hookFile, 'utf8');
        if (content.includes('strip-clanker-attribution')) {
            console.log('.husky/commit-msg already calls strip-clanker-attribution.');
            return;
        }
        writeFileSync(hookFile, `${HOOK_LINE}\n${content}`);
    } else {
        writeFileSync(hookFile, `${HOOK_LINE}\n`);
    }
    chmodSync(hookFile, 0o755);
    console.log('Added strip-clanker-attribution to .husky/commit-msg.');
}

main();
