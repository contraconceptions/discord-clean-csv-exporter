# Privacy

The extension runs in the browser with no analytics, tracking, remote processing, or application server. It does not request tokens or use Discord's private API.

Dates, filter text, format, and checkbox settings are saved in `chrome.storage.local`. Message records remain in tab memory until the page is closed/reloaded or another scan starts. They are never written to extension storage. Previews appear inside Discord. Files download only when selected by the user.

Discord itself may make requests as scrolling loads history. Exported files may contain personal information; the user controls their storage and distribution.

Remove the extension or clear its local extension storage to delete preferences. Close/reload the Discord tab to clear scan memory. No server-side deletion request is needed.
