module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // Блокировка any
    '@typescript-eslint/no-explicit-any': 'error',
    
    // Базовые правила TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    
    // Общие правила ESLint
    'no-console': 'off', // Разрешаем console.log для логирования
    'no-debugger': 'error',
    'no-eval': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'quotes': ['error', 'single'],
    'semi': ['error', 'always']
  },
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  globals: {
    NodeJS: 'readonly'
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.js',
    '*.d.ts',
    'coverage/',
    '.eslintrc.js'
  ]
}; 