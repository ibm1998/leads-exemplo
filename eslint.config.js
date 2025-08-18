
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/build/**',
      'src/types/rate-limiter-flexible.d.ts'
    ]
  },
  {
  files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parser: tsparser,
      globals: {
        fetch: 'readonly',
        NodeJS: 'readonly',
        vi: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        module: 'readonly',
        window: 'readonly',
        document: 'readonly',
        Buffer: 'readonly',
        Notification: 'readonly',
        global: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'no-undef': 'error',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/react-in-jsx-scope': 'off'
    }
  },
  {
    files: [
      '**/__tests__/**',
      '**/?(*.)+(spec|test).{js,jsx,ts,tsx}'
    ],
    languageOptions: {
      globals: {
        vi: 'readonly'
      }
    }
  }
];

