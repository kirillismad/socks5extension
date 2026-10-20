import test from 'node:test';
import assert from 'node:assert/strict';

async function loadOptions(context, sendMessage) {
  const elements = new Map();
  const controls = [];
  const createElement = () => ({
    value: '',
    textContent: '',
    hidden: true,
    disabled: false,
    children: [],
    listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    setAttribute() {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; }
  });
  const getElement = (selector) => {
    if (!elements.has(selector)) {
      const element = createElement();
      elements.set(selector, element);
      controls.push(element);
    }
    return elements.get(selector);
  };
  const previousChrome = globalThis.chrome;
  const previousDocument = globalThis.document;
  context.after(() => {
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  globalThis.chrome = { runtime: { sendMessage } };
  globalThis.document = {
    querySelector: getElement,
    querySelectorAll: () => controls,
    createElement
  };
  await import(`../options/options.js?test=${encodeURIComponent(context.name)}`);
  await new Promise((resolve) => setImmediate(resolve));
  return { getElement, controls };
}

test('options show load errors and do not enable editing with default settings', async (context) => {
  const { getElement, controls } = await loadOptions(context, async () => {
    throw new Error('Could not read settings locally.');
  });
  assert.equal(getElement('#data-message').hidden, false);
  assert.equal(getElement('#data-message').textContent, 'Could not read settings locally.');
  assert.equal(getElement('#proxy-uri').value, '');
  assert.equal(controls.every((control) => control.disabled), true);
});

test('options lock editing while saving and recover after a failed save', async (context) => {
  const settings = { version: 1, proxyUri: 'socks5://localhost:10808', exceptions: ['*.example.com'] };
  let completeSave;
  const { getElement, controls } = await loadOptions(context, (message) => {
    if (message.type === 'get-status') return Promise.resolve({ ok: true, settings });
    return new Promise((resolve) => { completeSave = resolve; });
  });
  assert.equal(controls.every((control) => !control.disabled), true);
  assert.equal(getElement('#proxy-uri').value, settings.proxyUri);
  assert.equal(getElement('#mask-list').children.length, 1);
  const form = getElement('#settings-form');
  const submission = form.listeners.submit({ preventDefault() {} });
  assert.equal(controls.every((control) => control.disabled), true);
  completeSave({ ok: false, error: 'Chrome rejected the proxy settings.' });
  await submission;
  assert.equal(controls.every((control) => !control.disabled), true);
  assert.equal(getElement('#uri-error').hidden, false);
  assert.equal(getElement('#uri-error').textContent, 'Chrome rejected the proxy settings.');

  const nextSubmission = form.listeners.submit({ preventDefault() {} });
  completeSave({ ok: true, settings });
  await nextSubmission;
  assert.equal(getElement('#uri-error').hidden, true);
  assert.equal(getElement('#save-status').textContent, 'Settings saved.');
  assert.equal(controls.every((control) => !control.disabled), true);
});