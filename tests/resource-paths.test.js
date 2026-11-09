const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function exists(relative) {
  assert.ok(fs.statSync(path.join(root, relative)).isFile(), relative);
}
// Resolve resources relative to a GitHub Pages project URL, not the domain root.
const site = new URL('https://ruruwu.github.io/skyloom/');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(https?:|#)/.test(match[1])) continue;
  const url = new URL(match[1], site);
  assert.ok(url.pathname.startsWith(site.pathname));
  exists(url.pathname.slice(site.pathname.length));
}
for (const match of html.matchAll(/content="(https:\/\/ruruwu.github.io\/skyloom\/[^" ]+\.jpg)"/g)) {
  exists(new URL(match[1]).pathname.slice(site.pathname.length));
}
for (const css of ['style.css', 'christmas.css']) {
  const relative = `assets/css/${css}`;
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  for (const match of text.matchAll(/url\("([^"]+)"\)/g)) {
    exists(path.posix.join(path.posix.dirname(relative), match[1]));
  }
}
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
for (const match of app.matchAll(/fetch\("([^"]+)"\)/g)) exists(match[1]);
for (const theme of ['sky', 'christmas']) {
  exists(`assets/icons/favicon-${theme}.svg`);
  exists(`assets/social/share-${theme}.jpg`);
}
console.log('HTML, CSS, prompt bank, favicon, and social image paths passed');
