import js from '@eslint/js';
import ts from 'typescript-eslint';
import lit from 'eslint-plugin-lit';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  lit.configs['flat/recommended'],
  prettier,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
];
