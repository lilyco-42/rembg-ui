import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:8765', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run serve', url: 'http://127.0.0.1:8765/product-images/', reuseExistingServer: false },
});
