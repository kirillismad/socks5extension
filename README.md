# SOCKS5 Route

A Manifest V3 Chrome extension that applies one SOCKS5 proxy configuration to supported Chrome URL requests, with hostname patterns that bypass the proxy.

## Install for development

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this project directory.
4. Open the extension's **Settings** page. New installations default to `socks5://localhost:10808`; change it if your SOCKS5 server uses another address.
5. Use the extension popup to enable or disable the proxy. The separate **Routing** switch controls exceptions: when enabled (the default), matching sites bypass the proxy; when disabled, all supported requests use the proxy. The exception list is preserved, and the routing mode is remembered across restarts.

The extension requests only the `proxy` and `storage` permissions. Settings remain in `chrome.storage.local`; there is no backend, telemetry, history access, or remote font/resource request.

## Routing limits and security

- Chrome's proxy settings apply to supported URL requests, including HTTP, HTTPS, and FTP. They do not proxy all device traffic or every browser protocol; separate UDP/WebRTC flows are outside this extension's routing guarantee.
- SOCKS5 DNS behavior depends on Chrome and is not guaranteed by this extension.
- Chrome documents that some non-fatal proxy errors can result in a direct connection. The PAC script has no direct alternative for proxied hosts, but that does not establish reliable fail-closed behavior. The popup reports proxy errors when Chrome emits them. Do not rely on this extension as a leak-prevention or security boundary.
- On enable, the extension checks whether it can control Chrome's proxy setting and refuses when another source controls it. On disable, it explicitly sets Chrome to `direct` mode, ignoring previous and system proxy settings. The disabled mode is also applied on installation, updates and Chrome startup. If an active proxy configuration no longer belongs to this extension or its PAC has changed, it leaves the setting untouched and reports an error. Another controlling extension or policy can prevent direct mode from being applied.
- Direct mode only bypasses Chrome proxy settings; it does not bypass a system VPN or TUN tunnel. Disabling or removing the extension releases its control, so Chrome may use system or other proxy settings again.
- Chrome may allow only one controlling proxy extension at a time. Enterprise policy can also prevent changes.

The `proxy` permission is required to configure Chrome proxy settings. No host permissions or browsing-history permissions are requested.

## Settings JSON

Exports use version 1:

```json
{
  "version": 1,
  "proxyUri": "socks5://localhost:10808",
  "exceptions": ["*.example.com"]
}
```

Import validates the complete file before asking for confirmation and applying it. Invalid files do not replace current settings.

## Test

Run `npm test` with Node.js 18 or newer.
