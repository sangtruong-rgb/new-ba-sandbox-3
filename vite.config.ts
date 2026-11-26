/// <reference types="vitest/config" />
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import devServer from '@hono/vite-dev-server';

export default defineConfig(() => {
  const plugins: PluginOption[] = [react()];
  if (!process.env.VITEST) {
    // Only /api/* goes to the Hono app; every other path is the React app.
    plugins.push(devServer({ entry: 'server/app.ts', exclude: [/^(?!\/api(?:[/?#]|$))/] }));
  }
  return {
    plugins,
    server: {
      port: Number(process.env.PORT || 5173),
      strictPort: true,
      host: true,
    },
    test: {
      include: ['server/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
      environment: 'node',
    },
  };
});
