import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  server: { proxy: { '/api': 'http://localhost:8097' } },
  test: { environment: 'happy-dom' },
});
