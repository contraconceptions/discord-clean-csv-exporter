# Manual release checks

Use a channel with permission to export and synthetic messages containing no personal data. Fixtures supplement these checks and do not replace live verification.

- Load unpacked; verify icons, popup labels, focus indicators, presets, and timezone.
- Check invalid/reversed dates, saved preferences, and errors on a non-Discord tab.
- Export short non-scrolling and long virtualized histories.
- Include grouped authors, changed authors, bots, replies, multiline text, quotes, emoji, empty messages, images, videos, audio, documents, and ordinary links.
- Confirm reply previews/embeds are omitted and media filtering targets uploaded media.
- Test filters separately/together and compare exclusion counts with the dataset.
- Verify inclusive date boundaries and a daylight-saving transition.
- Start from old history, a new channel, and a channel with no matches; inspect completion explanations.
- Pause/resume during initialization and scanning; stop while paused; attempt duplicate scans.
- Switch channels during loading/scanning; verify original data and filenames are retained.
- Interrupt loading/remove the message list; confirm partial download recovery.
- Preview/download CSV and JSON. Check the five-row preview cap and literal rendering of formula text.
- In the target spreadsheet application, verify formulas stay text and long IDs retain all digits. Check raw JSON strings.
- Close/reopen the popup during a scan. Reload the tab and verify conversations are not persisted.
- Test a second Discord UI language and record selector/localization problems.

Capture popup and result screenshots from this synthetic dataset for documentation. Never use private conversation screenshots.
