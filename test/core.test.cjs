const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../core.js');
const core = globalThis.DiscordExportCore;
const options = { startDate: '2026-03-08', endDate: '2026-03-08', format: 'csv' };
const timestamp = hour => new Date(2026, 2, 8, hour).toISOString();
const row = (id, username = 'Alice', extra = {}) => ({ messageId: String(id), timestamp: timestamp(12), username, message: 'Hello world', bot: false, media: false, attachment: false, ...extra });
const records = (...rows) => new Map(rows.map(value => [value.messageId, value]));
test('validates calendar dates and reversed ranges', () => {
  for (const values of [['2026-02-30', '2026-03-01'], ['', '2026-03-01'], ['2026-04-02', '2026-04-01']]) assert.throws(() => core.dateRange(...values));
});
test('inclusive local days follow DST rather than fixed 24-hour arithmetic', () => {
  const old = process.env.TZ; process.env.TZ = 'America/Los_Angeles';
  try {
    const spring = core.dateRange('2026-03-08', '2026-03-08');
    const fall = core.dateRange('2026-11-01', '2026-11-01');
    assert.equal(spring.end - spring.start + 1, 23 * 3600000);
    assert.equal(fall.end - fall.start + 1, 25 * 3600000);
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});
test('does not persist inferred authors while earlier virtualized history loads', () => {
  const data = records(row(3, ''), row(1, 'Alice', { timestamp: timestamp(10) }));
  assert.equal(core.evaluate(data, options).rows.at(-1).username, 'Alice');
  assert.equal(data.get('3').username, '');
  core.merge(data, row(2, 'Bob', { timestamp: timestamp(11) }));
  assert.equal(core.evaluate(data, options).rows.at(-1).username, 'Bob');
  assert.equal(data.get('3').username, '');
});
test('keeps unresolved authors and deduplicates repeated viewport observations', () => {
  const data = records(row(1, ''));
  core.merge(data, row(1, ''));
  assert.equal(data.size, 1);
  assert.equal(core.evaluate(data, options).reasons.unknownAuthor, 1);
});
test('applies filters and accounts for each excluded row once', () => {
  const data = records(row(1, 'Alice', { media: true }), row(2, 'Alice', { attachment: true }), row(3, 'Bot', { bot: true }), row(4, 'Bob'), row(5, 'Alice', { message: 'Bye' }), row(6));
  const result = core.evaluate(data, { ...options, excludeAttachments: true, excludeBots: true, author: 'ALICE', keyword: 'HELLO' });
  assert.deepEqual(result.rows.map(r => r.messageId), ['6']);
  for (const key of ['media', 'attachment', 'bot', 'author', 'keyword']) assert.equal(result.reasons[key], 1);
  assert.equal(core.evaluate(records(row(1, 'Alice', { media: true })), { ...options, excludeMedia: false }).rows.length, 1);
});
test('CSV escapes quotes/newlines and neutralizes formulas and long IDs', () => {
  assert.equal(core.csvCell('a,"b"\nc'), '"a,""b""\nc"');
  for (const value of ['=1+1', ' +1', '@SUM(A1)', '-2', '\t=1', '123456789012345678']) assert.ok(core.csvCell(value).startsWith('"\''));
});
test('JSON preserves raw values, metadata, context and message IDs', () => {
  const meta = { channelId: '22', path: '/channels/11/22', partial: true };
  const result = JSON.parse(core.serialize([row('123456789012345678', '=Alice', { message: '=1+1' })], { ...options, format: 'json', includeContext: true }, meta));
  assert.equal(result.messages[0].message, '=1+1');
  assert.equal(result.messages[0].message_id, '123456789012345678');
  assert.equal(result.messages[0].message_url, 'https://discord.com/channels/11/22/123456789012345678');
  assert.equal(result.metadata.partial, true);
});
// Minimal DOM fixtures exercise extraction independently of Discord's network.
function fixture({ name = 'Alice', message = 'Reply only', links = [], datetime = timestamp(12), bot = false } = {}) {
  return { id: 'chat-messages-22-123', querySelector(selector) {
    if (selector.includes('message-content-')) return { innerText: message };
    if (selector.includes('time[datetime]')) return { getAttribute: () => datetime };
    if (selector.includes('message-username-')) return name ? { innerText: name, querySelector: () => ({ innerText: name }) } : null;
    if (selector.includes('botTag')) return bot ? {} : null;
    return null;
  }, querySelectorAll: () => links.map(href => ({ getAttribute: () => href })) };
}
test('DOM extraction reads reply body, author, media and bot badge', () => {
  const result = core.extract(fixture({ links: ['https://cdn.discordapp.com/attachments/1/2/photo.PNG?x=1'], bot: true }));
  assert.equal(result.message, 'Reply only'); assert.equal(result.username, 'Alice'); assert.equal(result.media, true); assert.equal(result.bot, true);
});
test('DOM fixtures distinguish audio/documents from media, grouped authors and invalid times', () => {
  assert.equal(core.extract(fixture({ links: ['https://cdn.discordapp.com/attachments/1/2/file.pdf'] })).media, false);
  assert.equal(core.extract(fixture({ name: '' })).username, '');
  assert.equal(core.extract(fixture({ datetime: 'invalid' })), null);
  assert.equal(core.extract(fixture({ message: '' })).message, '');
});
