const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require.resolve('../assets/js/theme.js'), 'utf8');
const KEY = 'skyloom.theme.v1';
function load(values, blocked = false) {
  const handlers = {};
  const picker = { addEventListener: (name, callback) => { handlers[name] = callback; } };
  const status = {}, sky = {}, christmas = {};
  const favicon = { setAttribute(name, value) { this[name] = value; } };
  const document = {
    documentElement: { dataset: {} },
    addEventListener: (name, callback) => { handlers[name] = callback; },
    getElementById: id => id === 'themePicker' ? picker : id === 'themeFavicon' ? favicon : status,
    querySelector: selector => selector === '.sky-credit' ? sky : christmas
  };
  vm.runInNewContext(code, {
    document,
    localStorage: {
      getItem(key) { if (blocked) throw Error('blocked'); return values.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error('blocked'); values.set(key, value); }
    }
  });
  handlers.DOMContentLoaded();
  return { document, picker, status, sky, christmas, favicon, change(value) { picker.value = value; handlers.change(); } };
}
const library = JSON.stringify({ groups: ['c02'], prompts: ['keep'] });
const values = new Map([['skyloom.library.v1', library]]);
let page = load(values);
assert.equal(page.document.documentElement.dataset.theme, 'christmas');
assert.equal(page.christmas.hidden, false);
assert.equal(page.favicon.href, 'assets/icons/favicon-christmas.svg');
assert.equal(page.sky.hidden, true);
page.change('sky');
assert.equal(page.favicon.href, 'assets/icons/favicon-sky.svg');
page = load(values);
assert.equal(page.favicon.href, 'assets/icons/favicon-sky.svg');
assert.equal(page.picker.value, 'sky');
assert.equal(page.sky.hidden, false);
assert.equal(page.christmas.hidden, true);
page.change('christmas');
assert.equal(page.favicon.href, 'assets/icons/favicon-christmas.svg');
assert.equal(load(values).picker.value, 'christmas');
assert.equal(values.get('skyloom.library.v1'), library);
page = load(values, true);
page.change('sky');
assert.equal(page.document.documentElement.dataset.theme, 'sky');
assert.ok(page.status.textContent.includes('無法保存'));
values.set(KEY, 'invalid');
assert.equal(load(values).picker.value, 'christmas');
console.log('Theme switching, persistence, credits, storage isolation, and unavailable storage checks passed');
