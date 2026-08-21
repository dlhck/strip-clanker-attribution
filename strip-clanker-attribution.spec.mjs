import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { stripAiCommitAttribution } from './strip-clanker-attribution.mjs';

const script = fileURLToPath(new URL('./strip-clanker-attribution.mjs', import.meta.url));

test('strips Cursor, Claude, and Codex attribution and keeps human trailers', () => {
    const message = [
        'feat(quote-management): pick quote composition from license grants',
        '',
        'Keep init() on a stable wrapper class.',
        '',
        'Co-authored-by: Cursor <cursoragent@cursor.com>',
        'Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>',
        'Co-authored-by: Codex <noreply@openai.com>',
        'Co-authored-by: Jane Doe <jane@example.com>',
        'Made-with: Cursor',
        'Generated-by: Claude Code',
        'Codex-Session-Id: ses_123',
        '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
        'Generated with Codex (https://openai.com)',
        'Made with Cursor',
        '',
    ].join('\n');

    assert.equal(
        stripAiCommitAttribution(message),
        [
            'feat(quote-management): pick quote composition from license grants',
            '',
            'Keep init() on a stable wrapper class.',
            '',
            'Co-authored-by: Jane Doe <jane@example.com>',
            '',
        ].join('\n'),
    );
});

test('strips agent co-author trailers with a bare email and no name', () => {
    const message = 'fix(api): handle timeouts\n\nCo-authored-by: cursoragent@cursor.com\n';

    assert.equal(stripAiCommitAttribution(message), 'fix(api): handle timeouts\n');
});

test('strips Copilot, Devin, Jules, and Aider attribution', () => {
    const message = [
        'feat(api): add retry logic',
        '',
        'Co-authored-by: Copilot <198982749+Copilot@users.noreply.github.com>',
        'Co-authored-by: copilot-swe-agent[bot] <198982749+copilot@users.noreply.github.com>',
        'Co-authored-by: Copilot <167198135+copilot[bot]@users.noreply.github.com>',
        'Co-authored-by: Copilot copilot@github.com',
        'Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>',
        'Co-authored-by: google-labs-jules[bot] <161369871+google-labs-jules[bot]@users.noreply.github.com>',
        'Co-authored-by: Jules <noreply@jules.google>',
        'Co-authored-by: aider (gpt-4o) <noreply@aider.chat>',
        'Co-authored-by: openhands <openhands@all-hands.dev>',
        'Co-authored-by: opencode <opencode@example.com>',
        'Co-authored-by: amazon-q-developer[bot] <208079219+amazon-q-developer[bot]@users.noreply.github.com>',
        'Co-authored-by: gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>',
        'Generated with [Devin](https://cli.devin.ai/docs)',
        '',
    ].join('\n');

    assert.equal(stripAiCommitAttribution(message), 'feat(api): add retry logic\n');
});

test('keeps human co-authors who share a name with an agent', () => {
    const message = [
        'fix(ui): correct spacing',
        '',
        'Co-authored-by: Devin Ivy <devin@example.com>',
        'Co-authored-by: Jules Verne <jules@example.com>',
        '',
    ].join('\n');

    assert.equal(stripAiCommitAttribution(message), message);
});

test('strips GitHub bot co-authors regardless of the numeric id', () => {
    const message =
        'chore(deps): bump packages\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>\n';

    assert.equal(stripAiCommitAttribution(message), 'chore(deps): bump packages\n');
});

test('does not strip a body line that only mentions those tools', () => {
    const message =
        'fix(repo): document how Cursor attribution is stripped\n\nThe hook removes Claude and Codex trailers after git commit.\n';

    assert.equal(stripAiCommitAttribution(message), message);
});

test('rewrites a commit message file in place', (context) => {
    const dir = mkdtempSync(join(tmpdir(), 'strip-clanker-attribution-'));
    context.after(() => rmSync(dir, { recursive: true, force: true }));
    const file = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(file, 'chore(repo): test hook\n\nCo-authored-by: Cursor Agent <cursoragent@cursor.com>\n');

    const result = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(file, 'utf8'), 'chore(repo): test hook\n');
});

test('runs main when invoked through a bin symlink', (context) => {
    const dir = mkdtempSync(join(tmpdir(), 'strip-clanker-attribution-bin-'));
    context.after(() => rmSync(dir, { recursive: true, force: true }));
    const bin = join(dir, 'strip-clanker-attribution');
    chmodSync(script, 0o755);
    symlinkSync(script, bin);
    const file = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(file, 'chore(repo): test hook\n\nMade-with: Cursor\n');

    const result = spawnSync(bin, [file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(file, 'utf8'), 'chore(repo): test hook\n');
});

const initScript = fileURLToPath(new URL('./init.mjs', import.meta.url));

function makeRepo(context) {
    const dir = mkdtempSync(join(tmpdir(), 'strip-clanker-attribution-init-'));
    context.after(() => rmSync(dir, { recursive: true, force: true }));
    const init = spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    return dir;
}

test('init creates .husky/commit-msg', (context) => {
    const dir = makeRepo(context);
    mkdirSync(join(dir, '.husky'));

    const result = spawnSync(process.execPath, [initScript], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
        readFileSync(join(dir, '.husky', 'commit-msg'), 'utf8'),
        'npx strip-clanker-attribution "$1"\n',
    );
});

test('init prepends to an existing commit-msg hook only once', (context) => {
    const dir = makeRepo(context);
    mkdirSync(join(dir, '.husky'));
    const hook = join(dir, '.husky', 'commit-msg');
    writeFileSync(hook, 'bunx commitlint --edit "$1"\n');

    const first = spawnSync(process.execPath, [initScript], { cwd: dir, encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr);
    const second = spawnSync(process.execPath, [initScript], { cwd: dir, encoding: 'utf8' });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(
        readFileSync(hook, 'utf8'),
        'npx strip-clanker-attribution "$1"\nbunx commitlint --edit "$1"\n',
    );
});

test('init fails without a .husky directory', (context) => {
    const dir = makeRepo(context);

    const result = spawnSync(process.execPath, [initScript], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /husky/);
});
