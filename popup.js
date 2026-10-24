const form = document.querySelector('form');
const status = document.querySelector('#status');
const button = document.querySelector('#start');
const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function preset(days) {
  const end = new Date(), start = new Date(); start.setDate(start.getDate() - days + 1);
  form.elements.startDate.value = localDate(start); form.elements.endDate.value = localDate(end);
}
preset(7);
document.querySelector('#timezone').textContent = `Inclusive dates in ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`;
document.querySelector('#preset').addEventListener('change', event => { if (event.target.value) preset(Number(event.target.value)); });
const ready = chrome.storage.local.get('exportOptions').then(({ exportOptions }) => {
  if (!exportOptions) return;
  for (const [name, value] of Object.entries(exportOptions)) {
    const input = form.elements.namedItem(name);
    if (input) { if (input.type === 'checkbox') input.checked = value; else input.value = value; }
  }
}).catch(() => { status.textContent = 'Saved settings could not be read. Defaults are ready.'; });
form.addEventListener('submit', async event => {
  event.preventDefault(); await ready; button.disabled = true;
  try {
    const options = Object.fromEntries(new FormData(form));
    for (const name of ['excludeMedia', 'excludeAttachments', 'excludeBots', 'includeContext']) options[name] = form.elements[name].checked;
    DiscordExportCore.dateRange(options.startDate, options.endDate);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/discord\.com\/channels\/(?:\d+|@me)\/\d+\/?$/.test(tab.url || '')) throw new Error('Open a Discord text channel, then try again.');
    await chrome.storage.local.set({ exportOptions: options });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['core.js', 'content.js'] });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'START_CLEAN_EXPORT', options });
    if (!response?.ok) throw new Error(response?.error || 'The scan could not start.');
    status.textContent = 'Scanning. Use the panel inside Discord to pause, preview, and download.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
