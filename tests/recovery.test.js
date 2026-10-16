const assert = require('node:assert/strict');
const { createStore, KEY } = require('../skyloom-store');
// Run with the local Creative Arcana implementation to verify its actual backup.
const arcanaPath = process.argv[2];
const arcanaStore = arcanaPath ? require(arcanaPath) : null;
const LEGACY = 'creativeArcana.library.v3';
const BACKUP = 'creativeArcana.recovery.original.v1';
const now = Date.parse('2026-10-17T00:00:00Z');
const card = { deckId: 'c01', categoryId: 'c01', source: '測試', group: 'general', number: 1, prompt: '詞彙' };
const ca = { ...card, deckId: 'deck-148' };
delete ca.categoryId;
const library = prompts => ({ history: [], prompts, sets: [], decks: [], groups: ['general'] });
const mixed = JSON.stringify(library([card, ca]));
function fixture(initial = {}) {
  const values = new Map(Object.entries(initial)), reads = [], writes = [];
  let fail = false;
  const storage = {
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { if (fail) throw Error('quota'); writes.push(key); values.set(key, value); }
  };
  return { values, reads, writes, storage, fail(value) { fail = value; } };
}
const open = f => createStore(f.storage, () => now);
if (arcanaStore) {
  for (const skyloomFirst of [true, false]) {
    const f = fixture({ [LEGACY]: mixed });
    if (skyloomFirst) assert.equal(open(f).snapshot().prompts.length, 1);
    const caStore = arcanaStore.createStore(f.storage, () => now);
    assert.equal(caStore.loadError, false);
    assert.equal(caStore.snapshot().prompts.length, 1);
    assert.equal(f.values.get(BACKUP), mixed);
    const before = f.values.get(LEGACY);
    assert.deepEqual(open(f).snapshot().prompts, [card]);
    assert.equal(f.values.get(LEGACY), before);
    assert.equal(f.values.get(BACKUP), mixed);
  }
  console.log('TC01, TC02 PASS: actual Creative Arcana migration in both orders');
} else console.log('TC01, TC02 NOT TESTED: pass local arcana-store.js path');
const f = fixture({ [LEGACY]: JSON.stringify(library([ca])), [BACKUP]: mixed });
let store = open(f);
assert.deepEqual(store.snapshot().prompts, [card]); // TC04, TC05
assert.equal(f.values.get(BACKUP), mixed);
assert.ok(f.writes.every(key => key === KEY));
f.reads.length = 0;
store = open(f); // TC08, TC10
assert.deepEqual(store.snapshot().prompts, [card]);
assert.deepEqual(f.reads, [KEY]);
store.togglePrompt(card);
assert.equal(open(f).snapshot().prompts.length, 0); // TC09
for (const prompts of [[], [{ ...card, prompt: '目前資料' }]]) {
  for (const marker of [{}, { migrationVersion: 1 }]) {
    const existing = fixture({ [KEY]: JSON.stringify({ ...library(prompts), ...marker }), [LEGACY]: mixed, [BACKUP]: mixed });
    assert.deepEqual(open(existing).snapshot().prompts, prompts); // TC03, TC09
    assert.deepEqual(existing.reads, [KEY]);
  }
}
for (const raw of [JSON.stringify(library([ca])), '{}', '{broken']) {
  const invalid = fixture({ [BACKUP]: raw });
  assert.equal(open(invalid).snapshot().prompts.length, 0); // TC06, TC07
  assert.equal(invalid.values.get(BACKUP), raw);
}
for (const raw of ['{broken', '{}']) {
  const fallback = fixture({ [LEGACY]: raw, [BACKUP]: mixed });
  assert.deepEqual(open(fallback).snapshot().prompts, [card]);
  assert.equal(fallback.values.get(LEGACY), raw);
}
const retry = fixture({ [BACKUP]: mixed });
retry.fail(true);
store = open(retry);
assert.equal(store.loadError, true);
assert.equal(store.snapshot().migrationVersion, undefined);
assert.equal(retry.values.has(KEY), false);
assert.throws(() => store.togglePrompt(card));
retry.fail(false);
assert.deepEqual(open(retry).snapshot().prompts, [card]);
const protectedData = JSON.stringify(library([card]));
const failedSave = fixture({ [KEY]: protectedData, [BACKUP]: mixed });
failedSave.fail(true);
assert.deepEqual(open(failedSave).snapshot().prompts, [card]);
assert.equal(failedSave.values.get(KEY), protectedData);
for (const raw of ['null', '{broken', '{}']) {
  const broken = fixture({ [KEY]: raw, [BACKUP]: mixed });
  assert.equal(open(broken).loadError, true);
  assert.equal(broken.values.get(KEY), raw);
}
console.log('TC03–TC10 PASS; readonly sources, invalid sources, priority, and write retry PASS');
