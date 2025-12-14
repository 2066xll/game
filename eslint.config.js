import js from '@eslint/js';

export default [
  {
    files: ['src/**/*.js'],
    ignores: ['node_modules', 'dist', 'public/**', '**/workers/**', '**/test-*.js', 'server.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: true,
        document: true,
        navigator: true,
        console: true,
        fetch: true,
        Promise: true,
        setTimeout: true,
        clearTimeout: true,
        setInterval: true,
        clearInterval: true,
        localStorage: true,
        sessionStorage: true,
        WebSocket: true
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-prototype-builtins': 'off',
      'no-undef': 'off',
      'no-empty': 'off',
      'no-cond-assign': 'off',
      'no-useless-escape': 'off',
      'no-control-regex': 'off',
      'no-fallthrough': 'off',
      'no-func-assign': 'off'
    }
  }
];
