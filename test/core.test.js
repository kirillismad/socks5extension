import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import {
  buildPacScript,
  defaultSettings,
  matchesMask,
  parseProxyUri,
  validateMask,
  validateSettings
} from '../src/core.js';

test('uses localhost SOCKS5 as the default configuration', () => {
  assert.deepEqual(defaultSettings(), {
    version: 1,
    proxyUri: 'socks5://localhost:10808',
    exceptions: []
  });
});

test('accepts a SOCKS5 URI and extracts its host and port', () => {
  assert.deepEqual(parseProxyUri('socks5://proxy.example.net:1080'), {
    host: 'proxy.example.net',
    port: 1080
  });
});

test('rejects credentials, other schemes, and invalid ports', () => {
  assert.throws(() => parseProxyUri('socks5://user:pass@proxy.example.net:1080'), /credentials/i);
  assert.throws(() => parseProxyUri('http://proxy.example.net:8080'), /socks5/i);
  assert.throws(() => parseProxyUri('socks5://proxy.example.net:70000'), /valid SOCKS5 URI/i);
  assert.throws(() => parseProxyUri('socks5://bad..host:1080'), /valid hostname/i);
});

test('validates glob patterns and matches hostnames case-insensitively', () => {
  assert.equal(validateMask('*.example.com'), '');
  assert.equal(validateMask('https://example.com'), 'Use a hostname pattern only; do not include a scheme, path, or spaces.');
  assert.equal(matchesMask('shop.example.com', '*.example.com'), true);
  assert.equal(matchesMask('example.com', '*.example.com'), false);
  assert.equal(matchesMask('API.Example.com', 'api.?xample.com'), true);
});

test('validates imported settings before returning a normalized copy', () => {
  assert.deepEqual(validateSettings({
    version: 1,
    proxyUri: 'socks5://proxy.example.net:1080',
    exceptions: ['*.Example.com']
  }), {
    version: 1,
    proxyUri: 'socks5://proxy.example.net:1080',
    exceptions: ['*.example.com']
  });
  assert.throws(() => validateSettings({ version: 2, proxyUri: '', exceptions: [] }), /version/i);
  assert.deepEqual(validateSettings({ version: 1, proxyUri: '', exceptions: [] }), {
    version: 1,
    proxyUri: '',
    exceptions: []
  });
  assert.throws(() => validateSettings({ version: 1, proxyUri: '', exceptions: [], extra: true }), /unsupported fields/i);
});

test('PAC routes matching hosts direct and all other hosts through SOCKS5 only', () => {
  const pac = buildPacScript({ host: 'proxy.example.net', port: 1080 }, ['*.example.com']);
  const context = {};
  runInNewContext(pac, context);
  assert.equal(context.FindProxyForURL('https://shop.example.com', 'shop.example.com'), 'DIRECT');
  assert.equal(context.FindProxyForURL('https://example.com', 'example.com'), 'SOCKS5 proxy.example.net:1080');
  assert.equal(context.FindProxyForURL('https://other.net', 'other.net'), 'SOCKS5 proxy.example.net:1080');
});

test('PAC ignores exceptions when routing is disabled without changing the list', () => {
  const proxy = { host: 'proxy.example.net', port: 1080 };
  const exceptions = ['*.example.com', '*'];
  const context = {};
  runInNewContext(buildPacScript(proxy, exceptions, false), context);
  for (const host of ['shop.example.com', 'example.com', 'other.net']) {
    assert.equal(context.FindProxyForURL(`https://${host}`, host), 'SOCKS5 proxy.example.net:1080');
  }
  assert.deepEqual(exceptions, ['*.example.com', '*']);
  runInNewContext(buildPacScript(proxy, exceptions, true), context);
  assert.equal(context.FindProxyForURL('https://shop.example.com', 'shop.example.com'), 'DIRECT');
});

test('PAC and hostname matching use identical glob rules', () => {
  const proxy = { host: 'localhost', port: 10808 };
  const cases = [
    ['shop.example.com', '*.example.com', true],
    ['example.com', '*.example.com', false],
    ['API.Example.com', 'api.?xample.com', true],
    ['exampleXcom', 'example.com', false],
    ['any.host', '*', true],
    ['ab.example.com', '?.example.com', false],
    ['a.example.com', '?.example.com', true]
  ];
  for (const [host, mask, expected] of cases) {
    assert.equal(matchesMask(host, mask), expected);
    const context = {};
    runInNewContext(buildPacScript(proxy, [mask]), context);
    assert.equal(context.FindProxyForURL(`https://${host}`, host), expected ? 'DIRECT' : 'SOCKS5 localhost:10808');
  }
});