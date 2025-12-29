import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
    // Ignore patterns
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/out/**',
            '**/build/**',
            '**/.turbo/**',
            '**/coverage/**',
            '**/lib/**',
            '**/broadcast/**',
            '**/cache/**',
        ],
    },

    // Base config for all files
    eslint.configs.recommended,

    // TypeScript files
    ...tseslint.configs.recommended,

    // React hooks for TSX files
    {
        files: ['**/*.tsx'],
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },

    // Shared rules
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            // TypeScript specific
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'off',

            // General
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'prefer-const': 'error',
            'no-var': 'error',
        },
    },

    // Disable rules that conflict with Prettier
    prettier,
);
