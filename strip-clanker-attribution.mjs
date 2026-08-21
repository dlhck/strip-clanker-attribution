#!/usr/bin/env node
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const AGENT_EMAILS = [
    /cursoragent@cursor\.com/i,
    /noreply@anthropic\.com/i,
    /noreply@openai\.com/i,
    /noreply@aider\.chat/i,
    /openhands@all-hands\.dev/i,
    /noreply@jules\.google/i,
    /copilot@github\.com/i,
    // GitHub bot accounts commit as <id>+<login>[bot]@users.noreply.github.com.
    // The numeric id varies by product and rollout, so match the login only.
    /\+(copilot|copilot-swe-agent|devin-ai-integration|google-labs-jules|amazon-q-developer|gemini-code-assist|cline|continue|sourcegraph-cody|jetbrains-ai|coderabbitai|openai-codex|chatgpt-codex-connector|claude|anthropic-claude|claude-code-action|cursor)(\[bot\])?@users\.noreply\.github\.com$/i,
];

// Bare names that are safe to match without an email anchor. Human names like
// "Devin" or "Jules" are excluded on purpose; those agents are matched by email.
const AGENT_NAMES =
    /^(cursor(\s+agent)?|claude(\s+code)?(\s+\S+)*|codex|chatgpt(\s+codex)?|openai[- ]codex|copilot|copilot-swe-agent|google-labs-jules|aider(\s+\(.*\))?|openhands|opencode|amazon\s+q(\s+developer)?|gemini\s+code\s+assist)(\[bot\])?$/i;

const ATTRIBUTION_TRAILER_KEYS = /^(made-with|generated-with|generated-by|codex-session-id)$/i;

const GENERATED_WITH_LINE = /^(?:[\u{1F916}\u{2728}]\s*)?(?:generated|made)\s+with\b/iu;

const CO_AUTHORED_BY = /^\s*co-authored-by:\s*(.+?)\s*$/i;

/**
 * Drop commit attribution from Cursor, Claude, Codex, Copilot, Devin, Jules,
 * Aider, OpenHands, opencode, Amazon Q, and Gemini Code Assist.
 * Human Co-authored-by trailers and the rest of the body stay.
 */
export function stripAiCommitAttribution(message) {
    const newline = message.includes('\r\n') ? '\r\n' : '\n';
    const hadTrailingNewline = /\r?\n$/.test(message);
    const lines = message.split(/\r?\n/);
    const kept = [];

    for (const line of lines) {
        if (!isAiAttributionLine(line)) {
            kept.push(line);
        }
    }

    const normalized = collapseBlankLines(kept);
    const next = normalized.join(newline);
    if (!next) {
        return hadTrailingNewline ? newline : '';
    }
    return hadTrailingNewline ? `${next}${newline}` : next;
}

export function isAiAttributionLine(line) {
    const trimmed = line.trim();
    if (!trimmed) {
        return false;
    }

    const coAuthor = trimmed.match(CO_AUTHORED_BY);
    if (coAuthor) {
        return isAgentCoAuthor(coAuthor[1]);
    }

    const trailer = trimmed.match(/^([A-Za-z0-9-]+)\s*:\s*(.*)$/);
    if (trailer && ATTRIBUTION_TRAILER_KEYS.test(trailer[1])) {
        return trailer[1].toLowerCase() === 'codex-session-id' || mentionsAgent(trailer[2]);
    }

    return GENERATED_WITH_LINE.test(trimmed) && mentionsAgent(trimmed);
}

function isAgentCoAuthor(value) {
    const match = value.match(/^(.*?)(?:\s*<([^>]+)>\s*)?$/);
    const name = match?.[1]?.trim() ?? '';
    const email = match?.[2]?.trim() ?? '';
    // A bare address without angle brackets lands in `name`, so check both.
    const emailLike = email || (name.includes('@') ? name : '');
    if (emailLike && AGENT_EMAILS.some((pattern) => pattern.test(emailLike))) {
        return true;
    }
    return AGENT_NAMES.test(name);
}

function mentionsAgent(text) {
    return /\b(cursor|claude|codex|chatgpt|copilot|devin|jules|aider|openhands|opencode|gemini)\b/i.test(
        text,
    );
}

function collapseBlankLines(lines) {
    const next = [];
    for (const line of lines) {
        if (line.trim() === '') {
            if (next.length > 0 && next[next.length - 1] !== '') {
                next.push('');
            }
            continue;
        }
        next.push(line);
    }
    while (next.length > 0 && next[next.length - 1] === '') {
        next.pop();
    }
    return next;
}

function isExecutedDirectly() {
    const entry = process.argv[1];
    if (!entry) {
        return false;
    }
    return import.meta.url === pathToFileURL(realpathSync(resolve(entry))).href;
}

function main() {
    const file = process.argv[2];
    if (!file) {
        console.error('Usage: strip-clanker-attribution <commit-msg-file>');
        process.exit(1);
    }
    const original = readFileSync(file, 'utf8');
    writeFileSync(file, stripAiCommitAttribution(original));
}

if (isExecutedDirectly()) {
    main();
}
