const enabledInput = document.querySelector('#enabled');
const routingInput = document.querySelector('#routing-enabled');
const routingDescription = document.querySelector('#routing-description');
const routingPatterns = document.querySelector('#routing-patterns');
const patternList = document.querySelector('#pattern-list');
const patternsEmpty = document.querySelector('#patterns-empty');
const indicator = document.querySelector('#indicator');
const title = document.querySelector('#status-title');
const description = document.querySelector('#status-description');
const message = document.querySelector('#message');

async function request(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function showStatus(status) {
  enabledInput.checked = status.enabled;
  routingInput.checked = status.routingEnabled !== false;
  routingDescription.textContent = routingInput.checked
    ? 'Proxy with site exceptions'
    : 'All sites through proxy';
  const patterns = status.settings.exceptions;
  patternList.replaceChildren(...patterns.map((pattern) => {
    const item = document.createElement('li');
    item.textContent = pattern;
    return item;
  }));
  patternList.hidden = patterns.length === 0;
  patternsEmpty.hidden = patterns.length !== 0;
  routingPatterns.hidden = false;
  indicator.classList.toggle('active', status.enabled && !status.error);
  indicator.classList.toggle('has-error', Boolean(status.error));
  title.textContent = status.error ? 'Attention needed' : status.enabled ? 'Proxy enabled' : 'Proxy disabled';
  description.textContent = status.enabled
    ? 'Chrome proxy configuration is active'
    : 'Chrome connects directly without a proxy';
  message.hidden = !status.error;
  message.textContent = status.error || '';
}

async function refresh() {
  const response = await request('get-status');
  if (response?.ok) {
    showStatus(response);
    enabledInput.disabled = false;
    routingInput.disabled = false;
  }
  else {
    title.textContent = 'Status unavailable';
    description.textContent = 'Could not read proxy settings';
    message.hidden = false;
    message.textContent = response?.error || 'Could not read extension status.';
  }
}

async function changeMode(input, type, payload) {
  const previousChecked = !input.checked;
  enabledInput.disabled = true;
  routingInput.disabled = true;
  message.hidden = true;
  try {
    const response = await request(type, payload);
    if (!response?.ok) throw new Error(response?.error || 'Could not change proxy mode.');
    showStatus(response);
  } catch (error) {
    input.checked = previousChecked;
    message.hidden = false;
    message.textContent = error instanceof Error ? error.message : 'Could not change proxy mode.';
    indicator.classList.add('has-error');
    title.textContent = 'Attention needed';
  } finally {
    enabledInput.disabled = false;
    routingInput.disabled = false;
  }
}

enabledInput.addEventListener('change', () => {
  return changeMode(enabledInput, 'set-enabled', { enabled: enabledInput.checked });
});

routingInput.addEventListener('change', () => {
  return changeMode(routingInput, 'set-routing-enabled', { routingEnabled: routingInput.checked });
});

document.querySelectorAll('#settings, #configure').forEach((button) => {
  button.addEventListener('click', () => chrome.runtime.openOptionsPage());
});

refresh().catch(() => {
  title.textContent = 'Status unavailable';
  description.textContent = 'Could not read proxy settings';
});