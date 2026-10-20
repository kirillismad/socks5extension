# Chrome Web Store Listing

Copy the individual fields below into the developer dashboard. The primary listing language is English, matching the extension interface.

## Name

SOCKS5 Route

## Short Description

Route supported Chrome web requests through your SOCKS5 proxy, with optional hostname exceptions and a direct mode.

## Detailed Description

SOCKS5 Route lets you configure one SOCKS5 proxy for supported web requests in Chrome and choose which hostnames connect directly.

Bring your own SOCKS5 server. This extension does not provide a proxy server, VPN service, account, or subscription.

FEATURES

- Enable your SOCKS5 proxy from the toolbar popup.
- Turn the proxy off to explicitly select direct connections in Chrome, instead of falling back to a previous or system proxy configuration.
- Enable Routing to send matching hostname patterns directly and other supported requests through SOCKS5.
- Turn Routing off to use SOCKS5 for all supported requests while the proxy is enabled, without deleting your exception list.
- View the saved routing patterns in the popup without editing them.
- Add, edit, and remove up to 100 hostname exception patterns in Settings.
- Export and import the proxy URI and exception list as a versioned JSON file.
- Keep your configuration locally in this browser.

HOSTNAME PATTERNS

Patterns use `*` for any number of characters and `?` for one character. Matching ignores letter case and uses the hostname, not the URL path or query string. For example, `*.example.com` matches `shop.example.com` but not `example.com`. Add `example.com` separately if you want both.

GETTING STARTED

Open Settings and enter a SOCKS5 URI such as socks5://localhost:10808. You must already have a SOCKS5 server running at that address. Usernames and passwords are not supported. Enable the proxy in the popup, then choose whether to apply your routing exceptions.

PRIVACY AND PERMISSIONS

The proxy permission is used to change Chrome proxy settings. The storage permission is used to save the configuration locally. There is no developer-operated backend, analytics, or telemetry in the extension. Proxied requests are sent to the SOCKS5 server you choose; that server's operator has its own data practices.

IMPORTANT LIMITS

This is a Chrome proxy configuration tool, not a device-wide VPN or a guaranteed kill switch. It does not cover every browser protocol, separate UDP/WebRTC traffic, or other applications. DNS routing through SOCKS5 is not guaranteed. Chrome may connect directly after some proxy errors. Do not rely on the extension to prevent leaks or guarantee anonymity.

Turning the proxy off sets Chrome to direct mode; it does not bypass a system VPN or TUN tunnel. The saved enabled or disabled mode is applied on installation, updates, and Chrome startup, when Chrome allows the extension to control the setting. Another controlling extension or policy can prevent changes. Disabling or removing the extension releases its control, allowing system or other proxy settings to apply again.

The popup reports configuration state and errors reported by Chrome. It does not test whether your SOCKS5 server is reachable.

## Suggested Category

Developer Tools, or the closest available utility/networking category in the dashboard.

## Language

English

## Not Part of the Listing

Do not advertise a supplied proxy service, SOCKS5 authentication, a proxy health check, guaranteed anonymity, guaranteed proxy DNS, or fail-closed protection. These are not implemented or guaranteed.
