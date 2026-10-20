import { MAX_MASKS, SETTINGS_VERSION, validateMask, validateSettings } from '../src/core.js';

const form = document.querySelector('#settings-form');
const uriInput = document.querySelector('#proxy-uri');
const uriError = document.querySelector('#uri-error');
const saveStatus = document.querySelector('#save-status');
const newMask = document.querySelector('#new-mask');
const maskError = document.querySelector('#mask-error');
const maskList = document.querySelector('#mask-list');
const dataMessage = document.querySelector('#data-message');
let settings = null;
let busy = true;

async function request(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function showError(element, text) {
  element.textContent = text;
  element.hidden = !text;
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll('button, input').forEach((control) => {
    control.disabled = value;
  });
}

function renderMasks() {
  maskList.replaceChildren();
  settings.exceptions.forEach((mask, index) => {
    const item = document.createElement('li');
    item.className = 'mask-item';
    const value = document.createElement('span');
    value.className = 'mask-value';
    value.textContent = mask;

    const edit = document.createElement('button');
    edit.className = 'row-action';
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.setAttribute('aria-label', `Edit ${mask}`);
    edit.addEventListener('click', () => editMask(index));

    const remove = document.createElement('button');
    remove.className = 'row-action remove-action';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${mask}`);
    remove.addEventListener('click', () => removeMask(index));

    item.append(value, edit, remove);
    maskList.append(item);
  });
}

async function persist(nextSettings, message = 'Settings saved.') {
  if (!settings || busy) throw new Error('Wait until settings have finished loading or saving.');
  setBusy(true);
  try {
    const response = await request('save-settings', { settings: nextSettings });
    if (!response?.ok) throw new Error(response?.error || 'Could not save settings.');
    settings = response.settings;
    uriInput.value = settings.proxyUri;
    renderMasks();
    saveStatus.textContent = message;
    showError(uriError, '');
    showError(dataMessage, '');
  } finally {
    setBusy(false);
  }
}

function makeCandidate(proxyUri, exceptions) {
  return validateSettings({ version: SETTINGS_VERSION, proxyUri, exceptions });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveStatus.textContent = '';
  try {
    await persist(makeCandidate(uriInput.value, settings.exceptions));
  } catch (error) {
    showError(uriError, error instanceof Error ? error.message : 'Could not save settings.');
  }
});

function addMask() {
  const mask = newMask.value.trim();
  const issue = validateMask(mask);
  if (issue) {
    maskError.textContent = issue;
    return;
  }
  if (settings.exceptions.length >= MAX_MASKS) {
    maskError.textContent = `You can add up to ${MAX_MASKS} patterns.`;
    return;
  }
  if (settings.exceptions.includes(mask.toLowerCase())) {
    maskError.textContent = 'This pattern is already in the list.';
    return;
  }
  saveMaskList([...settings.exceptions, mask.toLowerCase()]);
}

async function saveMaskList(exceptions) {
  maskError.textContent = '';
  try {
    await persist(makeCandidate(uriInput.value, exceptions), 'Exception list saved.');
    newMask.value = '';
  } catch (error) {
    maskError.textContent = error instanceof Error ? error.message : 'Could not save the pattern.';
  }
}

function editMask(index) {
  const current = settings.exceptions[index];
  const replacement = window.prompt('Edit hostname pattern', current);
  if (replacement === null) return;
  const mask = replacement.trim().toLowerCase();
  const issue = validateMask(mask);
  if (issue) {
    showError(dataMessage, issue);
    return;
  }
  const updated = [...settings.exceptions];
  updated[index] = mask;
  if (new Set(updated).size !== updated.length) {
    showError(dataMessage, 'This pattern is already in the list.');
    return;
  }
  saveMaskList(updated);
}

function removeMask(index) {
  saveMaskList(settings.exceptions.filter((_, itemIndex) => itemIndex !== index));
}

document.querySelector('#add-mask').addEventListener('click', addMask);
newMask.addEventListener('input', () => {
  maskError.textContent = newMask.value ? validateMask(newMask.value.trim()) : '';
});
newMask.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addMask();
  }
});

document.querySelector('#export').addEventListener('click', () => {
  const file = new Blob([`${JSON.stringify(settings, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = 'socks5-route-settings.json';
  link.click();
  URL.revokeObjectURL(link.href);
});

const importFile = document.querySelector('#import-file');
document.querySelector('#import').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  importFile.value = '';
  if (!file) return;
  try {
    const imported = validateSettings(JSON.parse(await file.text()));
    if (!window.confirm('Importing will replace the current proxy URI and all exception patterns. Continue?')) return;
    await persist(imported, 'Settings imported.');
    showError(dataMessage, '');
  } catch (error) {
    showError(dataMessage, error instanceof Error ? error.message : 'Could not import this file.');
  }
});

async function initialize() {
  setBusy(true);
  try {
    const response = await request('get-status');
    if (!response?.ok) throw new Error(response?.error || 'Could not load settings.');
    settings = response.settings;
    uriInput.value = settings.proxyUri;
    renderMasks();
  } catch (error) {
    showError(dataMessage, error instanceof Error ? error.message : 'Could not load settings.');
  } finally {
    setBusy(settings === null);
  }
}

initialize();