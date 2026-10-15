# HireOS JD Renderer

An isolated Chromium for "Paste a Link or Text" (#64). Some job sites ship an empty page and load the posting
with scripts; the JD backend renders those pages here.

- The backend connects with `JD_LINK_RENDERER_URL` (`ws://jd-renderer:3010/`). Each connection gets its own
  browser, at most 2 at a time. Clients can't choose the executable or launch flags.
- The browser never goes to the network itself. The backend intercepts every request, checks it against
  the same public-address rules as a plain fetch, fetches it, and hands back the response.
- The container holds no secrets, runs as `node`, and is only on the `jd-render` network, which is
  `internal: true` (no internet, no other services). A compromised renderer has nothing to read and
  nowhere to connect.

Local development doesn't need this container: set `JD_LINK_BROWSER_PATH` to a local Chromium instead.
