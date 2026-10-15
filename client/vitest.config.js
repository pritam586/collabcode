import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
      // Component tests type character by character through user-event, which can pass the
      // 5 s default on a cold or busy machine.
      testTimeout: 15_000,
      // Styles do not affect what these tests check, and skipping them keeps runs fast.
      css: false,
    },
  }),
);
