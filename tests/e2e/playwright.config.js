// End-to-end suite for Build-Tech Pro. Drives the real app in a browser against the TEST
// project only (the served page refuses any other config). One worker, serial: the tests
// share one database and the office switch is global state, so they must not overlap.
const { defineConfig } = require('@playwright/test');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: [['list']],
  globalTeardown: require.resolve('./global-teardown.js'),
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 20000,
  },
  webServer: {
    command: 'node tests/serve.js',
    cwd: ROOT,
    url: 'http://127.0.0.1:5173/',
    reuseExistingServer: true,
    timeout: 20000,
  },
});
