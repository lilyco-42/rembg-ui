import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './checks', testMatch: '**/*.spec.mjs', retries: 0,
 reporter: [['list'], ['html', {open:'never'}]],
 use: {baseURL:'http://127.0.0.1:8765', screenshot:'only-on-failure', trace:'retain-on-failure'},
 webServer: {command:'npm run serve', url:'http://127.0.0.1:8765/downloads/index.html', reuseExistingServer:false},
});
