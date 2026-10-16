const assert = require('node:assert/strict');
const { createStore, KEY, poolFor } = require('../skyloom-store');
const LEGACY = 'creativeArcana.library.v3';
const now = Date.parse('2026-10-17T00:00:00Z');
const card = { deckId: 'c14', categoryId: 'c14', source: '植物', group: 'general', number: 31, prompt: '仙人掌' };
const arcana = { ...card, deckId: 'deck-136' };
const entry = (id, cards) => ({ id, date: new Date(now).toISOString(), mode: 'triple', cards });
const library = () => ({ history: [entry('sl', [card]), entry('ca', [arcana]), entry('mixed', [card, arcana]), null], prompts: [card, arcana, null, { ...card, deckId: 'unknown' }, { ...card, deckId: 'c99' }], sets: [entry('set', [card]), entry('mixed-set', [card, arcana])], decks: [{ id: 'c14', title: '植物', group: 'general', items: [{ number: 31, prompt: '仙人掌' }] }, { id: 'deck-136' }], groups: ['general', 'c14', 'c99'] });
function fixture(initial = {}) {
  const values = new Map(Object.entries(initial));
  let fail = false;
  const reads = [];
  return { values, reads, failWrites(value) { fail = value; }, storage: { getItem(key) { reads.push(key); return values.get(key) ?? null; }, setItem(key, value) { if (fail) throw new Error('quota'); values.set(key, value); } } };
}
const source = JSON.stringify(library());
const f = fixture({ [LEGACY]: source });
let store = createStore(f.storage, () => now);
assert.equal(store.loadError, false);
assert.deepEqual(store.snapshot().history.map(item => item.id), ['sl']);
assert.equal(store.snapshot().prompts.length, 1);
assert.equal(store.snapshot().sets.length, 1);
assert.equal(store.snapshot().decks.length, 1);
assert.deepEqual(store.snapshot().groups, ['c14']);
assert.equal(f.values.get(LEGACY), source);
assert.equal(JSON.parse(f.values.get(KEY)).migrationVersion, 1);
assert.equal(poolFor({ decks: [] }, store.snapshot(), 'favorites').length, 1);
// Clearing migrated content must not resurrect it on subsequent visits.
store.togglePrompt(card);
store.clearHistory();
f.reads.length = 0;
store = createStore(f.storage, () => now);
assert.equal(store.snapshot().prompts.length, 0);
assert.equal(store.snapshot().history.length, 0);
assert.ok(!f.reads.includes(LEGACY));
// Existing SL is cleaned and merged without replacing its settings or duplicates.
const existing = { ...library(), groups: [] };
const both = fixture({ [KEY]: JSON.stringify(existing), [LEGACY]: source });
store = createStore(both.storage, () => now);
assert.equal(store.snapshot().prompts.length, 1);
assert.deepEqual(store.snapshot().groups, []);
assert.ok(!both.values.get(KEY).includes('deck-'));
// Even an already migrated SL is filtered on load.
both.values.set(KEY, JSON.stringify({ ...library(), migrationVersion: 1 }));
both.reads.length = 0;
store = createStore(both.storage, () => now);
assert.equal(store.snapshot().history.length, 1);
assert.ok(!both.reads.includes(LEGACY));
// Import uses the same allowlist and ignores legacy backup fields.
store.importData({ format: 'skyloom-library', version: 1, data: library(), legacyData: library() });
assert.equal(store.snapshot().prompts.length, 1);
assert.equal(store.snapshot().history.length, 1);
// Failed migration leaves both keys untouched and retries successfully.
const retry = fixture({ [LEGACY]: source });
retry.failWrites(true);
store = createStore(retry.storage, () => now);
assert.equal(store.loadError, true);
assert.equal(retry.values.has(KEY), false);
assert.throws(() => store.togglePrompt(card));
assert.equal(retry.values.get(LEGACY), source);
retry.failWrites(false);
store = createStore(retry.storage, () => now);
assert.equal(store.loadError, false);
assert.equal(store.snapshot().prompts.length, 1);
// Unreadable JSON must not overwrite either original key or mark completion.
for (const key of [KEY, LEGACY]) {
  const broken = fixture({ [key]: '{broken' });
  assert.equal(createStore(broken.storage, () => now).loadError, true);
  assert.equal(broken.values.get(key), '{broken');
  if (key === LEGACY) assert.equal(broken.values.has(KEY), false);
}
console.log('Migration, cleanup, import filtering, and retry checks passed');
