export const SETTINGS_VERSION = 1;
export const MAX_MASKS = 100;
export const MAX_MASK_LENGTH = 253;

export function parseProxyUri(value) {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new Error('Enter a valid SOCKS5 URI, such as socks5://proxy.example.net:1080.');
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid SOCKS5 URI, such as socks5://proxy.example.net:1080.');
  }

  if (parsed.protocol !== 'socks5:') {
    throw new Error('Only the socks5:// scheme is supported.');
  }
  if (parsed.username || parsed.password || value.includes('@')) {
    throw new Error('SOCKS5 usernames and passwords are not supported. Remove credentials from the URI.');
  }
  if (!parsed.hostname || !parsed.port || (parsed.pathname && parsed.pathname !== '/') || parsed.search || parsed.hash) {
    throw new Error('Include a host and port only, for example socks5://proxy.example.net:1080.');
  }
  if (!isValidProxyHost(parsed.hostname)) {
    throw new Error('The proxy host must be a valid hostname or IP address.');
  }

  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('The proxy port must be between 1 and 65535.');
  }

  return { host: parsed.hostname, port };
}

function isValidProxyHost(host) {
  if (host.startsWith('[') && host.endsWith(']')) return true;
  if (host.length > 253) return false;
  return host.split('.').every((label) =>
    label.length >= 1 && label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

export function validateMask(mask) {
  if (typeof mask !== 'string' || mask.length === 0) {
    return 'Enter a hostname pattern.';
  }
  if (mask.length > MAX_MASK_LENGTH) {
    return `Patterns must be ${MAX_MASK_LENGTH} characters or fewer.`;
  }
  if (mask !== mask.trim() || /[\s/\\:@#]/.test(mask)) {
    return 'Use a hostname pattern only; do not include a scheme, path, or spaces.';
  }
  if (!/^[a-z0-9.*?-]+$/i.test(mask)) {
    return 'Use letters, numbers, dots, hyphens, * and ? only.';
  }

  const labels = mask.split('.');
  if (labels.some((label) => label.length === 0 && labels.length > 1)) {
    return 'Patterns cannot contain empty hostname labels.';
  }
  if (labels.some((label) => label.length > 63)) {
    return 'Hostname labels must be 63 characters or fewer.';
  }
  return '';
}

export function validateSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('The settings file must contain a JSON object.');
  }
  if (Object.keys(settings).some((key) => !['version', 'proxyUri', 'exceptions'].includes(key))) {
    throw new Error('The settings file contains unsupported fields.');
  }
  if (settings.version !== SETTINGS_VERSION) {
    throw new Error(`Unsupported settings version. Expected version ${SETTINGS_VERSION}.`);
  }
  if (typeof settings.proxyUri !== 'string') {
    throw new Error('The settings file is missing proxyUri.');
  }
  if (settings.proxyUri.trim()) parseProxyUri(settings.proxyUri);
  if (!Array.isArray(settings.exceptions) || settings.exceptions.length > MAX_MASKS) {
    throw new Error(`exceptions must be an array with no more than ${MAX_MASKS} patterns.`);
  }
  for (const mask of settings.exceptions) {
    const issue = validateMask(mask);
    if (issue) throw new Error(`Invalid exception pattern "${String(mask)}": ${issue}`);
  }
  return {
    version: SETTINGS_VERSION,
    proxyUri: settings.proxyUri.trim(),
    exceptions: [...new Set(settings.exceptions.map((mask) => mask.toLowerCase()))]
  };
}

export function matchesMask(host, mask) {
  const expression = new RegExp(globToRegex(mask), 'i');
  return expression.test(host.toLowerCase());
}

export function buildPacScript(proxy, exceptions, routingEnabled = true) {
  const patterns = JSON.stringify((routingEnabled ? exceptions : []).map((mask) => globToRegex(mask)));
  const host = proxy.host;
  return `var proxyAddress = ${JSON.stringify(`${host}:${proxy.port}`)};\n` +
    `var exceptionPatterns = ${patterns};\n` +
    'function FindProxyForURL(url, host) {\n' +
    '  host = host.toLowerCase();\n' +
    '  for (var i = 0; i < exceptionPatterns.length; i++) {\n' +
    '    if (new RegExp(exceptionPatterns[i], "i").test(host)) return "DIRECT";\n' +
    '  }\n' +
    '  return "SOCKS5 " + proxyAddress;\n' +
    '}';
}

function globToRegex(mask) {
  const escaped = mask.toLowerCase().replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
}

export function defaultSettings() {
  return { version: SETTINGS_VERSION, proxyUri: 'socks5://localhost:10808', exceptions: [] };
}