import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three-addons',
              test: /node_modules[\\/]three[\\/]examples[\\/]jsm[\\/]/,
              priority: 20,
              includeDependenciesRecursively: false,
            },
            {
              name: 'three',
              test: /node_modules[\\/]three[\\/]/,
              priority: 10,
            },
            {
              name: 'physics',
              test: /node_modules[\\/]cannon-es[\\/]/,
            },
            {
              name: 'math',
              test: /node_modules[\\/]gl-matrix[\\/]/,
            },
          ],
        },
      },
    },
  },
});
