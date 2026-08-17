// Flat ESLint config shared across the monorepo (ESLint 9).
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...tseslint.configs.recommended,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Guardrail (see SKILL.md invariant #2): never write escrow status directly.
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Literal[value=/UPDATE .*escrow_transactions.*SET status/i]",
          message: 'Move escrow status only via transition_escrow(). Direct status writes are forbidden.',
        },
      ],
    },
  },
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**'] },
];
