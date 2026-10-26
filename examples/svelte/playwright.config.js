import { defineConfig } from '@playwright/test';

const url = 'http://127.0.0.1:47143';

export default defineConfig({
  testDir: 'tests',
  workers: 1,
  use: { baseURL: url },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 47143 --strictPort',
    url,
    reuseExistingServer: !process.env.CI,
  },
  projects: ['chromium', 'firefox', 'webkit'].map((browserName) => ({
    name: browserName,
    use: { browserName },
  })),
});
