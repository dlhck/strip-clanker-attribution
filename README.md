# strip-clanker-attribution

Strip Cursor, Claude, and Codex attribution from commit messages. Built for husky `commit-msg` hooks.

Coding agents like to sign their work. This tool removes that signature before the commit lands, so your history stays clean and commitlint never chokes on a trailer it doesn't expect.

It removes:

- Agent co-author trailers, for example `Co-authored-by: Cursor <cursoragent@cursor.com>` or `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`. Human co-authors stay.
- Attribution trailers such as `Made-with: Cursor`, `Generated-by: Claude Code`, and `Codex-Session-Id: ses_123`.
- Signature lines like `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

It keeps everything else, including body text that merely mentions these tools.

## Install

```sh
npm install --save-dev strip-clanker-attribution
```

## Usage with husky

The package only ships the stripping script. Your repo's husky setup stays in charge of the hooks. If husky is already set up, wire it in from the repo root:

```sh
npx strip-clanker-attribution-init
```

This puts `npx strip-clanker-attribution "$1"` at the top of `.husky/commit-msg`, before commitlint or anything else that reads the message. Running it twice changes nothing. Without a `.husky` directory it stops and tells you to run `npx husky init` first.

Or add the line by hand:

```sh
npx strip-clanker-attribution "$1"
bunx commitlint --edit "$1"
```

The hook rewrites the commit message file in place, so anything after it sees the cleaned message. This works for `git commit`, `git merge`, `git revert`, and any other command that fires the `commit-msg` hook.

## CLI

```sh
strip-clanker-attribution <commit-msg-file>
```

Rewrites the file in place. Exits non-zero if no file is given.

## Programmatic use

```js
import { stripAiCommitAttribution } from 'strip-clanker-attribution';

const clean = stripAiCommitAttribution(rawCommitMessage);
```

The function takes the full commit message as a string and returns it without the attribution lines. It preserves the original line endings and collapses the blank lines the removals leave behind.

## Requirements

Node.js 18 or later. No dependencies.

## Releasing

Releases are tag-driven and published with npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC). No npm token is stored anywhere. One-time setup: on npmjs.com, open the package settings and add GitHub Actions as a trusted publisher for this repository with the `release.yml` workflow.

Then, from a clean `main`:

```sh
npm run release:patch   # or release:minor / release:major
```

This runs the tests, bumps the version, commits, tags `vX.Y.Z`, and pushes. The `release` workflow verifies the tag matches `package.json`, publishes to npm with provenance, and creates the GitHub release.

## License

MIT
