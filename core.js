(() => {
  const clean = value => String(value ?? '').replace(/\u00a0/g, ' ').trim();
  function dateRange(from, through) {
    const parse = value => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Choose valid dates.');
      const [y, m, d] = value.split('-').map(Number), date = new Date(y, m - 1, d);
      if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) throw new Error('Choose valid dates.');
      return date;
    };
    const start = parse(from), next = parse(through);
    next.setDate(next.getDate() + 1);
    if (start >= next) throw new Error('The start date must be on or before the finish date.');
    return { start: +start, end: +next - 1 };
  }
  function extract(item) {
    const messageId = item.id.match(/(\d+)$/)?.[1];
    if (!messageId) return null;
    const content = item.querySelector(`[id="message-content-${messageId}"]`);
    const time = item.querySelector(`#message-timestamp-${messageId} time[datetime]`) || item.querySelector('time[datetime]');
    const timestamp = time?.getAttribute('datetime');
    if (!Number.isFinite(Date.parse(timestamp))) return null;
    const author = item.querySelector(`[id="message-username-${messageId}"]`) || item.querySelector('[id^="message-username-"]');
    const username = clean(author?.querySelector('[role="button"]')?.innerText || author?.innerText);
    const links = [...item.querySelectorAll('a[href*="/attachments/"]')];
    const media = links.some(link => /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp|avi|m4v|mkv|mov|mp4|mpe?g|mpg|webm)(?:[?#]|$)/i.test(link.getAttribute('href') || ''));
    return { messageId, timestamp, username, message: clean(content?.innerText), media, attachment: links.length > 0,
      bot: !!item.querySelector('[data-tag="bot"], [class*="botTag"]') };
  }
  function merge(records, row) {
    if (!row) return;
    const old = records.get(row.messageId);
    records.set(row.messageId, { ...row, username: row.username || old?.username || '', bot: row.bot || old?.bot || false });
  }
  function evaluate(records, options) {
    const range = dateRange(options.startDate, options.endDate);
    const reasons = { outsideRange: 0, empty: 0, media: 0, attachment: 0, bot: 0, author: 0, keyword: 0, unknownAuthor: 0 }, rows = [];
    let author = '', bot = false;
    const sorted = [...records.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || (BigInt(a.messageId) < BigInt(b.messageId) ? -1 : 1));
    for (const observed of sorted) {
      if (observed.username) { author = observed.username; bot = observed.bot; }
      const row = { ...observed, username: observed.username || author, bot: observed.username ? observed.bot : bot };
      const epoch = Date.parse(row.timestamp);
      let reason;
      if (epoch < range.start || epoch > range.end) reason = 'outsideRange';
      else if (!row.message) reason = 'empty';
      else if (options.excludeMedia !== false && row.media) reason = 'media';
      else if (options.excludeAttachments && row.attachment) reason = 'attachment';
      else if (options.excludeBots && row.bot) reason = 'bot';
      else if (options.author && !row.username.toLowerCase().includes(options.author.toLowerCase())) reason = 'author';
      else if (options.keyword && !row.message.toLowerCase().includes(options.keyword.toLowerCase())) reason = 'keyword';
      if (reason) reasons[reason]++;
      else { if (!row.username) reasons.unknownAuthor++; rows.push(row); }
    }
    return { rows, reasons };
  }
  function csvCell(value) {
    let cell = String(value ?? '');
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(cell) || /^[\t\r\n]/.test(cell) || /^\d{16,}$/.test(cell)) cell = "'" + cell;
    return `"${cell.replace(/"/g, '""')}"`;
  }
  function serialize(rows, options, metadata) {
    const fields = ['timestamp', 'username', 'message', 'message_id'];
    if (options.includeContext) fields.push('channel_id', 'message_url');
    const data = rows.map(row => {
      const result = { timestamp: row.timestamp, username: row.username, message: row.message, message_id: row.messageId };
      if (options.includeContext) Object.assign(result, { channel_id: metadata.channelId, message_url: `https://discord.com${metadata.path}/${row.messageId}` });
      return result;
    });
    return options.format === 'json' ? JSON.stringify({ metadata, messages: data }, null, 2)
      : '\ufeff' + [fields, ...data.map(row => fields.map(key => row[key]))].map(cells => cells.map(csvCell).join(',')).join('\r\n');
  }
  globalThis.DiscordExportCore = { clean, dateRange, extract, merge, evaluate, csvCell, serialize };
})();
