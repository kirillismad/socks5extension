import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('routing mode persists and applies throughout the proxy lifecycle', async (context) => {
  const settings = { version: 1, proxyUri: 'socks5://localhost:10808', exceptions: ['*.example.com'] };
  let state = { settings, enabled: false, previousConfig: null, error: '' };
  let config = { levelOfControl: 'controllable_by_this_extension', value: { mode: 'system' } };
  let messageListener;
  let startupListener;
  let proxyErrorListener;
  let rejectConfig = false;
  let rejectRead = false;
  let rejectSave = false;
  let configWrites = 0;
  const previousChrome = globalThis.chrome;
  context.after(() => {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  });
  globalThis.chrome = {
    storage: {
      local: {
        get: (_key, callback) => {
          if (rejectRead) globalThis.chrome.runtime.lastError = { message: 'Read failed' };
          callback({ state: structuredClone(state) });
          delete globalThis.chrome.runtime.lastError;
        },
        set: (value, callback) => {
          if (rejectSave) globalThis.chrome.runtime.lastError = { message: 'Write failed' };
          else state = structuredClone(value.state);
          callback();
          delete globalThis.chrome.runtime.lastError;
        }
      }
    },
    runtime: {
      onMessage: { addListener: (listener) => { messageListener = listener; } },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: (listener) => { startupListener = listener; } }
    },
    proxy: {
      settings: {
        get: (_options, callback) => callback(structuredClone(config)),
        set: ({ value }, callback) => {
          if (rejectConfig) {
            globalThis.chrome.runtime.lastError = { message: 'Rejected' };
            callback();
            delete globalThis.chrome.runtime.lastError;
            return;
          }
          configWrites += 1;
          config = { levelOfControl: 'controlled_by_this_extension', value: structuredClone(value) };
          callback();
        }
      },
      onProxyError: { addListener: (listener) => { proxyErrorListener = listener; } }
    }
  };
  await import('../src/background.js');
  const send = (message) => new Promise((resolve) => messageListener(message, {}, resolve));
  const route = (host) => {
    const pacContext = {};
    runInNewContext(config.value.pacScript.data, pacContext);
    return pacContext.FindProxyForURL(`https://${host}`, host);
  };

  assert.equal((await send({ type: 'get-status' })).routingEnabled, true);
  assert.equal((await send({ type: 'set-enabled', enabled: true })).ok, true);
  assert.equal(route('shop.example.com'), 'DIRECT');
  assert.equal(route('other.net'), 'SOCKS5 localhost:10808');

  const concurrentResults = await Promise.all([
    send({ type: 'set-routing-enabled', routingEnabled: false }),
    send({ type: 'save-settings', settings })
  ]);
  assert.equal(concurrentResults.every((result) => result.ok), true);
  assert.equal(state.routingEnabled, false);
  assert.equal(route('shop.example.com'), 'SOCKS5 localhost:10808');

  const disabledRouting = await send({ type: 'set-routing-enabled', routingEnabled: false });
  assert.equal(disabledRouting.ok, true);
  assert.equal(disabledRouting.enabled, true);
  assert.equal(disabledRouting.routingEnabled, false);
  assert.equal(state.routingEnabled, false);
  assert.deepEqual(state.settings.exceptions, ['*.example.com']);
  assert.equal(route('shop.example.com'), 'SOCKS5 localhost:10808');

  assert.equal((await send({ type: 'save-settings', settings: { ...settings, exceptions: ['other.net'] } })).ok, true);
  assert.equal(route('other.net'), 'SOCKS5 localhost:10808');
  await startupListener();
  assert.equal(route('other.net'), 'SOCKS5 localhost:10808');

  rejectConfig = true;
  assert.equal((await send({ type: 'set-routing-enabled', routingEnabled: true })).ok, false);
  assert.equal(state.routingEnabled, false);
  assert.equal(route('other.net'), 'SOCKS5 localhost:10808');
  rejectConfig = false;
  assert.equal((await send({ type: 'set-routing-enabled', routingEnabled: 'false' })).ok, false);
  assert.equal(state.routingEnabled, false);

  rejectConfig = true;
  assert.equal((await send({ type: 'set-enabled', enabled: false })).ok, false);
  assert.equal(state.enabled, true);
  assert.equal(config.value.mode, 'pac_script');
  rejectConfig = false;
  state.previousConfig = {
    hasValue: true,
    value: { mode: 'fixed_servers', rules: { singleProxy: { scheme: 'socks5', host: 'old.proxy', port: 1080 } } }
  };
  assert.equal((await send({ type: 'set-enabled', enabled: false })).ok, true);
  assert.deepEqual(config.value, { mode: 'direct' });
  assert.equal(state.previousConfig, null);
  assert.equal((await send({ type: 'set-enabled', enabled: false })).ok, true);
  assert.deepEqual(config.value, { mode: 'direct' });
  config = { levelOfControl: 'controllable_by_this_extension', value: { mode: 'system' } };
  await startupListener();
  assert.deepEqual(config.value, { mode: 'direct' });
  assert.equal(state.enabled, false);
  const writesBeforeToggle = configWrites;
  assert.equal((await send({ type: 'set-routing-enabled', routingEnabled: true })).ok, true);
  assert.equal(configWrites, writesBeforeToggle);
  assert.equal((await send({ type: 'set-enabled', enabled: true })).ok, true);
  assert.equal(route('other.net'), 'DIRECT');
  assert.equal((await send({ type: 'set-enabled', enabled: false })).ok, true);
  assert.deepEqual(config.value, { mode: 'direct' });

  config = { levelOfControl: 'controlled_by_other_extensions', value: { mode: 'system' } };
  const writesBeforeConflict = configWrites;
  await startupListener();
  assert.equal(configWrites, writesBeforeConflict);
  assert.deepEqual(config.value, { mode: 'system' });
  assert.match(state.error, /controlled by another source/i);
  assert.equal((await send({ type: 'set-enabled', enabled: false })).ok, false);
  assert.equal(configWrites, writesBeforeConflict);
  config = { levelOfControl: 'controllable_by_this_extension', value: { mode: 'system' } };
  await startupListener();
  assert.deepEqual(config.value, { mode: 'direct' });

  const writesBeforeInvalidMessage = configWrites;
  assert.equal((await send({ type: 'set-enabled', enabled: 'false' })).ok, false);
  assert.equal(configWrites, writesBeforeInvalidMessage);

  await Promise.all([
    send({ type: 'set-routing-enabled', routingEnabled: false }),
    proxyErrorListener({ fatal: true })
  ]);
  assert.equal(state.routingEnabled, false);
  assert.match(state.error, /stopped a request/i);

  rejectRead = true;
  const readFailure = await send({ type: 'get-status' });
  assert.equal(readFailure.ok, false);
  assert.match(readFailure.error, /read settings locally/i);
  rejectRead = false;

  rejectSave = true;
  const saveFailure = await send({ type: 'set-routing-enabled', routingEnabled: true });
  assert.equal(saveFailure.ok, false);
  assert.match(saveFailure.error, /save settings locally/i);
  assert.equal(state.routingEnabled, false);
  rejectSave = false;
  assert.equal((await send({ type: 'set-routing-enabled', routingEnabled: true })).ok, true);
  assert.equal((await send({ type: 'get-status' })).routingEnabled, true);
});

test('popup loads routing mode, sends changes and restores the switch on failure', async () => {
  const elements = new Map();
  const getElement = (selector) => {
    if (!elements.has(selector)) {
      elements.set(selector, {
        checked: false,
        disabled: true,
        hidden: true,
        textContent: '',
        children: [],
        replaceChildren(...children) { this.children = children; },
        classList: { toggle() {}, add() {} },
        addEventListener(type, listener) { this[type] = listener; }
      });
    }
    return elements.get(selector);
  };
  const status = {
    ok: true,
    enabled: true,
    routingEnabled: false,
    error: '',
    settings: { exceptions: ['*.example.com', 'api.?xample.net'] }
  };
  const requests = [];
  let failure = false;
  const source = await readFile(new URL('../popup/popup.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    document: {
      querySelector: getElement,
      querySelectorAll: () => [],
      createElement: (tagName) => ({ tagName, textContent: '' })
    },
    chrome: {
      runtime: {
        sendMessage: async (message) => {
          requests.push(message);
          if (failure) throw new Error('Connection lost');
          if (message.type === 'set-routing-enabled') status.routingEnabled = message.routingEnabled;
          return { ...status };
        }
      }
    }
  });
  await new Promise((resolve) => setImmediate(resolve));
  const routingInput = getElement('#routing-enabled');
  assert.equal(routingInput.checked, false);
  assert.equal(routingInput.disabled, false);
  assert.equal(getElement('#routing-description').textContent, 'All sites through proxy');
  const patternList = getElement('#pattern-list');
  assert.equal(getElement('#routing-patterns').hidden, false);
  assert.equal(patternList.hidden, false);
  assert.equal(getElement('#patterns-empty').hidden, true);
  assert.equal(patternList.children.length, 2);
  assert.equal(patternList.children[0].tagName, 'li');
  assert.equal(patternList.children[0].textContent, '*.example.com');
  assert.equal(patternList.children[1].textContent, 'api.?xample.net');

  routingInput.checked = true;
  const pending = routingInput.change();
  assert.equal(routingInput.disabled, true);
  assert.equal(getElement('#enabled').disabled, true);
  await pending;
  assert.equal(requests.at(-1).type, 'set-routing-enabled');
  assert.equal(requests.at(-1).routingEnabled, true);
  assert.equal(getElement('#routing-description').textContent, 'Proxy with site exceptions');
  assert.equal(patternList.children.length, 2);
  assert.equal(patternList.children[0].textContent, '*.example.com');

  status.enabled = false;
  status.settings.exceptions = [];
  routingInput.checked = false;
  await routingInput.change();
  assert.equal(getElement('#status-description').textContent, 'Chrome connects directly without a proxy');
  assert.equal(patternList.children.length, 0);
  assert.equal(patternList.hidden, true);
  assert.equal(getElement('#patterns-empty').hidden, false);

  status.settings.exceptions = ['other.net'];
  routingInput.checked = true;
  await routingInput.change();
  assert.equal(patternList.children.length, 1);
  assert.equal(patternList.children[0].textContent, 'other.net');
  assert.equal(patternList.hidden, false);
  assert.equal(getElement('#patterns-empty').hidden, true);

  failure = true;
  routingInput.checked = false;
  await routingInput.change();
  assert.equal(routingInput.checked, true);
  assert.equal(routingInput.disabled, false);
  assert.equal(getElement('#enabled').disabled, false);
  assert.equal(getElement('#message').hidden, false);
});