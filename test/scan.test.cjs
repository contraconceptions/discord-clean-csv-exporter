const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');

// Browser lifecycle harness: a small DOM surface with deterministic history batches.
function browser({ navigate = false, fail = false, short = false, stall = false } = {}) {
  let listener, finished, ticks = 0, top = 0, batch = 0, clicked = 0;
  const done = new Promise(resolve => { finished = resolve; });
  const location = { pathname: '/channels/11/22' }, downloads = [];
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.style = {}; this.textContent = ''; }
    append(node) { this.children.push(node); if (node.tag === 'button' && node.textContent === 'Close') finished(); }
    replaceChildren() { this.children = []; }
    remove() {}
    click() { clicked++; downloads.push(this.download); }
    querySelector(selector) { return this.parts?.[selector] || null; }
    set innerHTML(_value) { this.parts = Object.fromEntries(['[data-progress]', '[data-controls]', '[data-preview]'].map(key => [key, new Element()])); }
  }
  const root = new Element();
  const scroll = { clientHeight: 600, scrollHeight: short ? 200 : 1400, parentElement: null,
    get scrollTop() { return top; }, set scrollTop(value) {
      if (value >= this.scrollHeight) top = Math.max(0, this.scrollHeight - this.clientHeight);
      else { top = Math.max(0, value); if (!short && !stall) batch = 1; }
    } };
  const list = { parentElement: scroll, querySelector: () => short ? {} : null };
  const record = id => ({ id: `chat-messages-22-${id}`, querySelector(selector) {
    if (selector.includes('message-content')) return { innerText: '=example' };
    if (selector.includes('time[datetime]')) return { getAttribute: () => id === 1 ? '2026-03-07T12:00:00Z' : '2026-03-08T12:00:00Z' };
    if (selector.includes('message-username')) return { innerText: 'Alice', querySelector: () => null };
    return null;
  }, querySelectorAll: () => [] });
  const document = { documentElement: root, createElement: tag => new Element(tag),
    querySelector(selector) {
      if (selector.includes('data-list-id')) {
        if (fail && batch) throw new Error('Fixture history error');
        return list;
      }
      if (selector === '#discord-clean-export-status') return root.children[0] || null;
      return null;
    },
    querySelectorAll(selector) { return selector.includes('li[') ? (batch ? [record(1), record(2)] : [record(2)]) : []; } };
  const context = vm.createContext({ document, location, Blob, URL, Intl, Date, Map, BigInt,
    getComputedStyle: () => ({ overflowY: 'auto' }),
    setTimeout(callback) { ticks++; if (navigate && batch) location.pathname = '/channels/11/99'; queueMicrotask(callback); return ticks; },
    chrome: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } } });
  // Accelerate time-based retries without real sleeps.
  vm.runInContext('Date = class extends Date { static now() { return globalThis.clock = (globalThis.clock || 0) + 1000; } }', context);
  vm.runInContext(readFileSync('core.js', 'utf8'), context);
  vm.runInContext(readFileSync('content.js', 'utf8'), context);
  const options = { startDate: '2026-03-08', endDate: '2026-03-08', format: 'json' };
  const start = () => { let response; listener({ type: 'START_CLEAN_EXPORT', options }, {}, value => { response = value; }); return response; };
  return { start, done, root, downloads, get clicks() { return clicked; } };
}
test('scan previews a complete date range without automatic downloads', async () => {
  const app = browser(); assert.equal(app.start().ok, true);
  assert.equal(app.start().ok, false);
  await app.done;
  const panel = app.root.children[0];
  assert.match(panel.querySelector('[data-progress]').textContent, /Scan complete/);
  assert.equal(app.clicks, 0);
  assert.match(panel.querySelector('[data-controls]').children[0].textContent, /Download JSON$/);
});
test('channel navigation retains original records as a partial preview', async () => {
  const app = browser({ navigate: true }); app.start(); await app.done;
  const panel = app.root.children[0];
  assert.match(panel.querySelector('[data-progress]').textContent, /Partial scan.*Channel changed/);
  assert.match(panel.querySelector('[data-controls]').children[0].textContent, /partial/);
  panel.querySelector('[data-controls]').children[0].onclick();
  assert.match(app.downloads[0], /^discord-22-.*-partial.json$/);
});
test('short non-overflowing histories can complete', async () => {
  const app = browser({ short: true }); app.start(); await app.done;
  assert.match(app.root.children[0].querySelector('[data-progress]').textContent, /Scan complete.*Beginning/);
});
test('history exceptions retain collected rows and download controls', async () => {
  const app = browser({ fail: true }); app.start(); await app.done;
  const panel = app.root.children[0];
  assert.match(panel.querySelector('[data-progress]').textContent, /Partial scan.*Fixture history error/);
  assert.match(panel.querySelector('[data-controls]').children[0].textContent, /Download JSON/);
});
test('unchanging histories terminate with a partial explanation', async () => {
  const app = browser({ stall: true }); app.start(); await app.done;
  assert.match(app.root.children[0].querySelector('[data-progress]').textContent, /Partial scan.*stopped changing/);
});
test('pause/resume controls toggle and cancellation preserves collected rows', async () => {
  const app = browser(); app.start();
  const panel = app.root.children[0], controls = panel.querySelector('[data-controls]');
  const pause = controls.children[0];
  pause.onclick(); assert.equal(pause.textContent, 'Resume');
  pause.onclick(); assert.equal(pause.textContent, 'Pause');
  pause.onclick(); controls.children[1].onclick();
  await app.done;
  assert.match(panel.querySelector('[data-progress]').textContent, /Partial scan: 1 eligible.*Stopped by you/);
});
