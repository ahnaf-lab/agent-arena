// Reads and writes replay files as plain JSON. A bare file name (no
// directory separators), the normal way to refer to a replay, is confined
// to the replays/ directory so a name can never escape it; an explicit
// relative or absolute path is honored as-is, the same as any ordinary CLI
// tool that takes a --out <path> argument.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPLAY_FORMAT_VERSION } from './record.js';

export const REPLAY_DIR = path.resolve('replays');

export function replayPathFor(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('replay file name must be a non-empty string');
  }
  if (name.includes('\0')) {
    throw new Error('replay file name contains an invalid character');
  }
  if (!name.includes('/') && !name.includes('\\')) {
    const fileName = name.endsWith('.json') ? name : `${name}.json`;
    return path.join(REPLAY_DIR, fileName);
  }
  return path.resolve(name);
}

export function validateReplay(replay) {
  if (!replay || typeof replay !== 'object') {
    throw new Error('replay file is not a JSON object');
  }
  if (replay.version !== REPLAY_FORMAT_VERSION) {
    throw new Error(`unsupported replay format version: ${replay.version}`);
  }
  if (!Array.isArray(replay.frames)) {
    throw new Error('replay file is missing its frames array');
  }
  if (!Array.isArray(replay.agentNames) || !Array.isArray(replay.pairings)) {
    throw new Error('replay file is missing agentNames/pairings');
  }
  return replay;
}

export function saveReplay(replay, name) {
  validateReplay(replay);
  const filePath = replayPathFor(name);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(replay, null, 2));
  return filePath;
}

export function loadReplay(name) {
  const filePath = replayPathFor(name);
  if (!existsSync(filePath)) {
    throw new Error(`no replay file found at ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf8');
  return validateReplay(JSON.parse(raw));
}
