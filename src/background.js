import { buildPacScript, defaultSettings, parseProxyUri, validateSettings } from './core.js';

const STATE_KEY = 'state';
let pendingOperation = Promise.resolve();

function enqueueOperation(operation) {
  const result = pendingOperation.then(operation);
  pendingOperation = result.catch(() => {});
  return result;
}

function getState() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(STATE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error('Could not read settings locally.'));
        return;
      }
      resolve({
        settings: defaultSettings(),
        enabled: false,
        previousConfig: null,
        error: '',
        routingEnabled: true,
        ...result[STATE_KEY]
      });
    });
  });
}

function saveState(state) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STATE_KEY]: state }, () => {
      if (chrome.runtime.lastError) reject(new Error('Could not save settings locally.'));
      else resolve();
    });
  });
}

function getProxyConfig() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.get({ incognito: false }, (config) => {
      if (chrome.runtime.lastError) reject(new Error('Could not read Chrome proxy settings.'));
      else resolve(config);
    });
  });
}

function setProxyConfig(value) {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.set({ value, scope: 'regular' }, () => {
      if (chrome.runtime.lastError) reject(new Error('Chrome rejected the proxy settings.'));
      else resolve();
    });
  });
}

async function activate(settings, routingEnabled) {
  const control = await getProxyConfig();
  if (control.levelOfControl !== 'controllable_by_this_extension' &&
      control.levelOfControl !== 'controlled_by_this_extension') {
    throw new Error('Chrome proxy settings are controlled by another source. Disable that proxy manager before continuing.');
  }

  const proxy = parseProxyUri(settings.proxyUri);
  await setProxyConfig({
    mode: 'pac_script',
    pacScript: {
      mandatory: true,
      data: buildPacScript(proxy, settings.exceptions, routingEnabled)
    }
  });
}

async function enableProxy(state) {
  if (!state.settings.proxyUri) throw new Error('Add a valid SOCKS5 URI in Settings before enabling the proxy.');
  await activate(state.settings, state.routingEnabled);
  await saveState({ ...state, enabled: true, previousConfig: null, error: '' });
  return getStatus();
}

async function disableProxy(state) {
  const current = await getProxyConfig();
  if (state.enabled) {
    if (current.levelOfControl !== 'controlled_by_this_extension') {
      throw new Error('Chrome proxy settings changed outside this extension. They were left untouched.');
    }
    const activeProxy = parseProxyUri(state.settings.proxyUri);
    const expectedPac = buildPacScript(activeProxy, state.settings.exceptions, state.routingEnabled);
    if (current.value?.mode !== 'pac_script' || current.value.pacScript?.data !== expectedPac) {
      throw new Error('Chrome proxy settings no longer match this extension. They were left untouched.');
    }
  } else if (current.levelOfControl !== 'controllable_by_this_extension' &&
             current.levelOfControl !== 'controlled_by_this_extension') {
    throw new Error('Chrome proxy settings are controlled by another source. Disable that proxy manager before continuing.');
  }

  await setProxyConfig({ mode: 'direct' });

  await saveState({ ...state, enabled: false, previousConfig: null, error: '' });
  return getStatus();
}

async function getStatus() {
  const state = await getState();
  let control;
  try {
    control = await getProxyConfig();
  } catch {
    control = null;
  }
  return {
    settings: state.settings,
    enabled: state.enabled,
    routingEnabled: state.routingEnabled,
    error: state.error,
    controlledByThisExtension: control?.levelOfControl === 'controlled_by_this_extension'
  };
}

async function saveSettings(state, input) {
  const settings = validateSettings(input);
  if (state.enabled) await activate(settings, state.routingEnabled);
  await saveState({ ...state, settings, previousConfig: null, error: '' });
  return getStatus();
}

async function setRoutingEnabled(state, routingEnabled) {
  if (typeof routingEnabled !== 'boolean') throw new Error('Routing mode must be a boolean.');
  if (state.enabled) await activate(state.settings, routingEnabled);
  await saveState({ ...state, routingEnabled, previousConfig: null, error: '' });
  return getStatus();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  enqueueOperation(async () => {
    try {
      const state = await getState();
      let result;
      if (message?.type === 'get-status') result = await getStatus();
      else if (message?.type === 'set-enabled') {
        if (typeof message.enabled !== 'boolean') throw new Error('Proxy mode must be a boolean.');
        result = message.enabled ? await enableProxy(state) : await disableProxy(state);
      } else if (message?.type === 'set-routing-enabled') {
        result = await setRoutingEnabled(state, message.routingEnabled);
      } else if (message?.type === 'save-settings') result = await saveSettings(state, message.settings);
      else throw new Error('Unknown request.');
      sendResponse({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      try {
        const state = await getState();
        await saveState({ ...state, error: message });
      } finally {
        sendResponse({ ok: false, error: message });
      }
    }
  });
  return true;
});

chrome.proxy.onProxyError.addListener((details) => {
  return enqueueOperation(async () => {
    const state = await getState();
    const message = details.fatal
      ? 'Chrome stopped a request because of a proxy error.'
      : 'Chrome reported a proxy error and may have used a direct connection.';
    await saveState({ ...state, error: message });
  });
});

async function restoreAfterRestart() {
  const state = await getState();
  try {
    if (state.enabled) {
      await activate(state.settings, state.routingEnabled);
      await saveState({ ...state, previousConfig: null, error: '' });
    } else {
      await disableProxy(state);
    }
  } catch (error) {
    await saveState({
      ...state,
      error: error instanceof Error ? error.message : 'Could not restore the proxy configuration.'
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  return enqueueOperation(async () => {
    const state = await getState();
    await saveState(state);
    await restoreAfterRestart();
  });
});

chrome.runtime.onStartup.addListener(() => enqueueOperation(restoreAfterRestart));