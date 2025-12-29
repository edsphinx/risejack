import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import mkcert from 'vite-plugin-mkcert';
import { visualizer } from 'rollup-plugin-visualizer';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    preact(),
    mkcert(),
    visualizer({
      open: false,
      gzipSize: true,
      filename: 'dist/stats.html',
    }),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // React compat for any libraries that need it
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      // Porto namespace compatibility (rise-wallet-sdk uses old import paths)
      'porto/Porto': 'porto',
      'porto/Chains': 'porto',
      'porto/Key': 'porto',
      'porto/Account': 'porto',
    },
  },

  server: {
    port: 5173,
  },

  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          viem: ['viem'],
          porto: ['porto', 'rise-wallet-sdk'],
        },
      },
    },
  },

  optimizeDeps: {
    include: ['preact', 'viem', 'porto', 'rise-wallet-sdk'],
  },
});
