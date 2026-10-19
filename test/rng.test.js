import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, randomInt } from '../src/engine/rng.js';

test('same seed produces the same sequence', () => {
  const rngA = createRng(42);
  const rngB = createRng(42);
  const sequenceA = Array.from({ length: 10 }, () => rngA());
  const sequenceB = Array.from({ length: 10 }, () => rngB());
  assert.deepStrictEqual(sequenceA, sequenceB);
});

test('different seeds produce different sequences', () => {
  const rngA = createRng(1);
  const rngB = createRng(2);
  const sequenceA = Array.from({ length: 5 }, () => rngA());
  const sequenceB = Array.from({ length: 5 }, () => rngB());
  assert.notDeepStrictEqual(sequenceA, sequenceB);
});

test('randomInt stays within the inclusive bounds', () => {
  const rng = createRng(7);
  for (let i = 0; i < 200; i++) {
    const value = randomInt(rng, 3, 9);
    assert.ok(value >= 3 && value <= 9, `expected ${value} within [3, 9]`);
  }
});
