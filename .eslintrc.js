module.exports = {
  env: {
    node: true,
    es6: true,
    commonjs: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'off'
  },
  ignorePatterns: ['node_modules/', '*.test.js']
};