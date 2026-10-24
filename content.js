(() => {
  if (globalThis.__discordCleanExporterLoaded) return;
  globalThis.__discordCleanExporterLoaded = true;
  const core = globalThis.DiscordExportCore;
  const state = { running: false, paused: false, stop: false, records: new Map() };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const list = () => document.querySelector('[data-list-id="chat-messages"]');
  function scroller() {
    let node = list()?.parentElement;
    while (node) {
      if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
      node = node.parentElement;
    }
    return list()?.parentElement;
  }
  const signature = () => [...document.querySelectorAll('li[id^="chat-messages-"]')].map(node => node.id).join('|');
  async function waitForChange(before, path, timeout = 2500) {
    const until = Date.now() + timeout;
    do {
      await sleep(150);
      if (state.stop || location.pathname !== path) return;
      if (signature() !== before) { await sleep(250); return; }
    } while (Date.now() < until);
  }
  function scan(path) {
    if (location.pathname !== path) throw new Error('Channel changed.');
    for (const item of document.querySelectorAll('li[id^="chat-messages-"]')) core.merge(state.records, core.extract(item));
  }
  function historyStart() {
    return !!list()?.querySelector('[data-list-item-id*="chat-messages___start"], [class*="channelNotice"], [class*="beginning"]');
  }
  function overlay() {
    document.querySelector('#discord-clean-export-status')?.remove();
    const root = document.createElement('section');
    root.id = 'discord-clean-export-status';
    root.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;width:340px;max-height:80vh;overflow:auto;padding:16px;background:#f7f9fc;color:#102a43;border:2px solid #102a43;border-radius:8px;box-shadow:0 8px 28px #0005;font:13px/1.5 Segoe UI,sans-serif';
    root.innerHTML = '<strong>Discord export</strong><p data-progress role="status" aria-live="polite">Preparing scan...</p><div data-controls></div><div data-preview></div>';
    document.documentElement.append(root);
    return root;
  }
  function addButton(parent, label, handler) {
    const button = document.createElement('button');
    button.textContent = label; button.type = 'button';
    button.style.cssText = 'padding:8px;margin:4px 4px 4px 0;border:1px solid #52667a;border-radius:4px;background:#102a43;color:white;cursor:pointer';
    button.onclick = handler; parent.append(button); return button;
  }
  function download(rows, options, metadata) {
    const json = options.format === 'json';
    const blob = new Blob([core.serialize(rows, options, metadata)], { type: json ? 'application/json' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `discord-${metadata.channelId}-${options.startDate}-through-${options.endDate}${metadata.partial ? '-partial' : ''}.${json ? 'json' : 'csv'}`;
    document.documentElement.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function run(options) {
    state.running = true; state.stop = false; state.paused = false; state.records.clear();
    const path = location.pathname;
    const root = overlay(), progress = root.querySelector('[data-progress]'), controls = root.querySelector('[data-controls]');
    const pause = addButton(controls, 'Pause', () => { state.paused = !state.paused; pause.textContent = state.paused ? 'Resume' : 'Pause'; });
    addButton(controls, 'Stop and preview partial', () => { state.stop = true; });
    let reason = '', complete = false;
    try {
      const range = core.dateRange(options.startDate, options.endDate);
      if (!list() || !scroller()) throw new Error('Message history not found. Open a text channel and try again.');
      scan(path);
      let bottomVerified = false, stable = 0;
      for (let attempt = 0; attempt < 12 && !state.stop; attempt++) {
        if (location.pathname !== path) throw new Error('Channel changed during initialization.');
        if (state.paused) { progress.textContent = 'Paused. Select Resume to continue.'; await sleep(200); attempt--; continue; }
        progress.textContent = 'Finding the newest loaded messages...';
        const before = signature();
        const jump = document.querySelector('[class*="jumpToPresentBar"] button') || [...document.querySelectorAll('button')].find(button => /jump to present/i.test(button.getAttribute('aria-label') || button.innerText));
        if (jump) jump.click();
        const scroll = scroller();
        if (!scroll) throw new Error('Message history disappeared.');
        scroll.scrollTop = scroll.scrollHeight;
        await waitForChange(before, path);
        scan(path);
        if (before === signature() && scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 5 && !jump) stable++;
        else stable = 0;
        if (stable >= 2) { bottomVerified = true; break; }
      }
      let stalls = 0;
      while (!state.stop) {
        if (location.pathname !== path) throw new Error('Channel changed.');
        if (state.paused) { progress.textContent = `Paused. ${state.records.size} messages collected.`; await sleep(200); continue; }
        scan(path);
        let earliest = Infinity;
        for (const row of state.records.values()) earliest = Math.min(earliest, Date.parse(row.timestamp));
        progress.textContent = `${state.records.size.toLocaleString()} messages collected. Earliest: ${Number.isFinite(earliest) ? new Date(earliest).toLocaleString() : 'loading'}.`;
        if (earliest < range.start || historyStart()) {
          complete = bottomVerified;
          reason = complete ? (historyStart() ? 'Beginning of channel history reached.' : 'Requested date boundary reached.') : 'Older boundary reached, but the newest position could not be verified.';
          break;
        }
        const before = signature(), scroll = scroller();
        if (!scroll) throw new Error('Message history disappeared.');
        scroll.scrollTop = Math.max(0, scroll.scrollTop - Math.max(200, scroll.clientHeight * 0.65));
        await waitForChange(before, path, Math.min(2500 + stalls * 500, 6000));
        if (signature() === before) stalls++; else stalls = 0;
        if (stalls >= 6) { reason = 'History stopped changing; the beginning of the channel could not be verified.'; break; }
      }
      if (state.stop) reason = 'Stopped by you.';
    } catch (error) { complete = false; reason = error.message; }
    finally { state.running = false; state.paused = false; }
    const { rows, reasons } = core.evaluate(state.records, options);
    const metadata = { channelId: path.split('/')[3], path, partial: !complete, reason, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, exportedAt: new Date().toISOString(), startDate: options.startDate, endDate: options.endDate, scanned: state.records.size, reasons };
    progress.textContent = `${complete ? 'Scan complete' : 'Partial scan'}: ${rows.length.toLocaleString()} eligible of ${state.records.size.toLocaleString()} collected. ${reason}`;
    controls.replaceChildren();
    addButton(controls, `Download ${options.format.toUpperCase()}${complete ? '' : ' (partial)'}`, () => download(rows, options, metadata));
    addButton(controls, 'Close', () => root.remove());
    const preview = root.querySelector('[data-preview]'), summary = document.createElement('p');
    summary.textContent = Object.entries(reasons).filter(([, count]) => count).map(([key, count]) => `${key}: ${count}`).join(' | ') || 'No messages excluded.';
    preview.append(summary);
    if (reasons.unknownAuthor) { const note = document.createElement('p'); note.textContent = 'Unresolved authors are left blank.'; preview.append(note); }
    for (const row of rows.slice(0, 5)) { const sample = document.createElement('p'); sample.textContent = `${row.username || 'Unknown author'}: ${row.message.slice(0, 180)}`; preview.append(sample); }
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'START_CLEAN_EXPORT') return;
    if (state.running) { respond({ ok: false, error: 'A scan is already running in this tab.' }); return; }
    try {
      const options = message.options;
      core.dateRange(options.startDate, options.endDate);
      if (!/^\/channels\/(?:\d+|@me)\/\d+$/.test(location.pathname)) throw new Error('Open a Discord text channel.');
      if (!['csv', 'json'].includes(options.format)) throw new Error('Choose CSV or JSON.');
      if (!list()) throw new Error('Message history not found.');
      void run(options).catch(error => { state.running = false; const progress = document.querySelector('#discord-clean-export-status [data-progress]'); if (progress) progress.textContent = error.message; });
      respond({ ok: true });
    } catch (error) { respond({ ok: false, error: error.message }); }
  });
})();
