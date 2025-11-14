module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2021: true
  },
  extends: [
    'plugin:vue/vue3-recommended',
    'eslint:recommended',
    '@vue/prettier'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    parser: '@babel/eslint-parser',
    sourceType: 'module',
    requireConfigFile: false
  },
  rules: {
    // Vue规则
    'vue/multi-word-component-names': 'off',
    'vue/require-default-prop': 'warn',
    'vue/require-explicit-emits': 'warn',
    'vue/no-unused-components': 'warn',
    'vue/no-unused-vars': 'warn',
    'vue/html-indent': ['error', 2],
    'vue/singleline-html-element-content-newline': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    
    // JavaScript规则
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-unused-vars': 'warn',
    'no-var': 'error',
    'prefer-const': 'error',
    'arrow-spacing': ['error', { before: true, after: true }],
    'comma-dangle': ['error', 'never'],
    'comma-spacing': ['error', { before: false, after: true }],
    'eqeqeq': ['error', 'always'],
    'func-call-spacing': ['error', 'never'],
    'indent': ['error', 2],
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],
    'keyword-spacing': ['error', { before: true, after: true }],
    'linebreak-style': ['error', 'unix'],
    'no-multi-spaces': ['error'],
    'no-trailing-spaces': ['error'],
    'object-curly-spacing': ['error', 'always'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'space-before-blocks': ['error', 'always'],
    'space-before-function-paren': ['error', 'never'],
    'space-in-parens': ['error', 'never'],
    'space-infix-ops': ['error'],
    'space-unary-ops': ['error', { words: true, nonwords: false }]
  }
};