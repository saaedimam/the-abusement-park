import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['functions/**/*.js', 'public/scripts/**/*.js', 'scripts/**/*.mjs', 'tests/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        AbortSignal: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        fetch: 'readonly',
        caches: 'readonly',
        process: 'readonly',
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        structuredClone: 'readonly',
        clearTimeout: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }]
    }
  },
  { ignores: ['node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', '.wrangler/**'] }
]);
