const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createStore, KEY, poolFor, sample, sampleBalanced, cardKey } = require('../skyloom-store');
const bank = require('../everyday_prompt_bank_v2_zh_tw.json');
const words = fs.readFileSync(require.resolve('../christmas_3tag_100.txt'), 'utf8').split(/\r?\n/);
if (words.at(-1) === '') words.pop();
const christmas = bank.categories.find(category => category.id === 'c18');
assert.equal(words.length, 100);
assert.equal(new Set(words).size, 100);
assert.deepEqual(christmas.words, words);
assert.equal(christmas.defaultEnabled, false);
const defaults = bank.categories.filter(category => category.defaultEnabled !== false).map(category => category.id);
assert.equal(defaults.length, 17);
assert.equal(bank.categories.filter(category => category.id !== 'c18').flatMap(category => category.words).length, 720);
const data = { decks: bank.categories.map(category => ({ id: category.id, categoryId: category.id, title: category.name, group: 'general', items: category.words.map((prompt, index) => ({ number: index + 1, prompt })) })) };
function fixture(groups) {
  const values = new Map();
  if (groups !== undefined) values.set(KEY, JSON.stringify({ history: [], prompts: [], sets: [], decks: [], groups }));
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  return () => createStore(storage, undefined, defaults);
}
const fresh = fixture();
assert.deepEqual(fresh().snapshot().groups, defaults);
assert.equal(poolFor(data, fresh().snapshot(), 'all').length, 720);
for (const groups of [[], ['c02', 'c14'], defaults]) {
  const reopen = fixture(groups);
  let store = reopen();
  assert.deepEqual(store.snapshot().groups, groups);
  assert.ok(poolFor(data, store.snapshot(), 'all').every(card => card.deckId !== 'c18'));
  store.setGroups([...groups, 'c18']);
  store = reopen();
  assert.deepEqual(store.snapshot().groups, [...groups, 'c18']);
  assert.equal(poolFor(data, store.snapshot(), 'all').filter(card => card.deckId === 'c18').length, 100);
  store.setGroups(groups);
  assert.deepEqual(reopen().snapshot().groups, groups);
}
const reopen = fixture(['c18']);
let store = reopen();
const pool = poolFor(data, store.snapshot(), 'all');
assert.equal(pool.length, 100);
const entry = { id: 'christmas', date: new Date().toISOString(), cards: sample(pool, 3) };
store.record(entry);
store.togglePrompt(pool[0]);
store.toggleSet(entry);
store.toggleDeck(data.decks.at(-1));
store = reopen();
assert.equal(store.snapshot().history.length, 1);
assert.equal(store.snapshot().prompts.length, 1);
assert.equal(store.snapshot().sets.length, 1);
assert.equal(store.snapshot().decks.length, 1);
assert.equal(poolFor(data, store.snapshot(), 'favorites').length, 1);
assert.equal(poolFor(data, store.snapshot(), 'decks').length, 100);
const imported = fixture()();
imported.importData(store.exportBackup());
assert.deepEqual(imported.snapshot(), store.snapshot());
store.setGroups(['c01', 'c18']);
const mixed = poolFor(data, store.snapshot(), 'all');
assert.deepEqual(new Set(mixed.map(card => card.deckId)), new Set(['c01', 'c18']));
for (const available of [pool, mixed]) {
  for (const draw of [sample(available, 3), sampleBalanced(available, 3)]) {
    assert.equal(draw.length, 3);
    assert.equal(new Set(draw.map(cardKey)).size, 3);
  }
}
const distinct = sampleBalanced(mixed, 3, true);
assert.equal(distinct.length, 2);
assert.equal(new Set(distinct.map(card => card.categoryId)).size, 2);
store.setGroups(['c01']);
assert.equal(poolFor(data, store.snapshot(), 'favorites').length, 0);
assert.equal(poolFor(data, store.snapshot(), 'decks').length, 0);
console.log('Christmas data, defaults, saved settings, draws, collections, and backup checks passed');
