import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Component tests (issue #34): jsdom + Testing Library, network modules mocked per test file.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
  },
});
