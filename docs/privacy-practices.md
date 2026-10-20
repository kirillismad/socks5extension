# Developer Dashboard: Privacy Practices

These are field-by-field drafts for the current version, not a substitute for the publisher's policy review. Update them if the implementation or any related service changes.

## Single Purpose

Configure one user-provided SOCKS5 proxy for supported Chrome web requests, with optional hostname exceptions and an explicit direct-connection mode.

## Permission Justification: proxy

Required to read and change Chrome's proxy configuration. The extension applies a locally generated PAC script for SOCKS5 routing and hostname exceptions, selects direct mode when the user disables the proxy, and listens for Chrome proxy errors. It checks whether it can control the setting before applying changes. This permission is necessary for the extension's sole purpose.

## Permission Justification: storage

Required to save the user-entered SOCKS5 URI, hostname exception patterns, enabled and routing flags, and extension error state in chrome.storage.local. This preserves the configuration across popup openings and browser restarts. The extension does not use cloud sync or transmit these stored settings to the developer.

## Host Permissions

None requested. There are no content scripts or browsing-history permissions.

## Remote Code

Select "No, I am not using remote code."

All JavaScript and styles are included in the extension package. PAC code is generated locally from validated settings; no remote PAC file or executable code is downloaded.

## Data Use

The extension has no developer-operated collection endpoint, analytics, advertising, or telemetry. It stores configuration and error state locally; it does not record visited URLs or browsing history. JSON export creates a local file only when the user requests it, and import reads a file chosen by the user.

Proxied web traffic necessarily passes through the SOCKS5 server selected by the user. Do not describe this as "no data ever leaves the device." The developer does not provide that server or receive its traffic through an extension backend. Reassess the disclosures if you later provide a proxy service, network diagnostics endpoint, analytics, or support-data upload.

Review the dashboard's current definitions and attest only to statements that accurately describe the submitted extension and any associated services. Do not declare local configuration processing to be developer-side collection, or omit an associated service that actually collects user data.

## Privacy Policy URL

Host privacy-policy.html at a stable, publicly accessible HTTPS URL and paste that URL into the dashboard. A local filesystem path is not a public policy URL. Review the policy before publishing it.

## Publisher Details

Use your real publisher name and a verified support email. No publisher identity, support address, or hosted policy URL has been invented for these materials.
