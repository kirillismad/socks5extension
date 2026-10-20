# Reviewer Test Instructions

## Requirements

- Desktop Google Chrome.
- A reachable SOCKS5 server without username/password authentication, provided by the tester. The extension does not include a proxy service and has no account or login requirement.
- No other extension or policy controlling Chrome proxy settings.

The initial URI is socks5://localhost:10808. It only works if a SOCKS5 server is actually running on the reviewer's computer at that address. No live server, credentials, or public open proxy is bundled with this submission. The publisher should supply any additional review access requested by the store through the private dashboard, not through public screenshots.

## Basic Flow

1. Install the extension. Its saved proxy mode is initially disabled. The extension selects Chrome direct mode when control is available; it does not restore or retain an existing system proxy configuration for Chrome.
2. Open the toolbar popup and select the settings gear or "Configure proxy and exceptions".
3. Set the URI to your reachable server, for example socks5://localhost:10808, and select "Save settings".
4. Add example.com and *.example.com under "Direct connections".
5. Open the popup, enable the proxy, and enable Routing. The read-only routing list should show both patterns.
6. Visit example.com and a reachable site outside the exception list. Matching hostnames use DIRECT; other supported requests use SOCKS5. Confirm using your controlled server logs or Chrome network diagnostics, not the popup label alone.
7. Turn Routing off without disabling the proxy. Both matching and nonmatching hostnames should now be assigned SOCKS5. The saved patterns should remain visible.
8. Disable the proxy. Chrome should use direct mode, even if it previously used a system or other saved proxy. This does not bypass an OS VPN or TUN tunnel.
9. With the proxy disabled, toggle Routing. This only changes the saved routing preference and must not enable SOCKS5.
10. Restart Chrome. The saved proxy/direct mode and routing preference should be applied again when the extension can control the proxy setting.

## Validation and Settings Files

1. In Settings, try an HTTP proxy URI and a SOCKS5 URI with user:password@host credentials. Both should be rejected without replacing the saved configuration.
2. Try `https://example.com` as a hostname pattern. It should be rejected because patterns must not contain a scheme or path.
3. Edit and remove a pattern. Save results should be reflected when reopening the popup.
4. Export JSON, change a setting, then import the exported file and confirm replacement. The proxy URI and exception list should be restored. Proxy enabled and Routing flags are not part of the exported settings file.
5. Import malformed JSON or an unsupported settings version. Existing settings should remain unchanged and an error should be shown.

## Errors and Limitations

- If another source controls Chrome proxy settings, the extension reports an error rather than overriding that source.
- Stop your SOCKS5 server and make a new request requiring SOCKS5. The browser may report a connection error. The extension displays proxy errors if Chrome emits them; it does not perform a server health check.
- The popup's enabled label describes configuration state, not successful connectivity.
- Some Chrome proxy errors can result in a direct connection. There is no guaranteed kill switch, DNS routing guarantee, or full-device traffic coverage.
- Release materials include UI screenshots rendered with synthetic example settings. They are not evidence of a successful network or proxy integration test.

## Test Evidence Available in the Repository

Run npm test with Node.js 18 or newer. Tests cover URI and settings validation, hostname matching, PAC routing, serialized background state changes, direct-mode disabling and restart, and selected popup/options interactions using mocks. These do not replace manual Chrome network testing.
