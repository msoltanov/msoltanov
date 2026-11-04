import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'assets/**', 'output/**', 'tasks/**'] },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.nodeBuiltin,
    },
    rules: {
      'prefer-template': 'error',
      'no-multi-str': 'error',
      curly: ['error', 'all'],
      camelcase: ['error', { properties: 'never' }],
      'new-cap': ['error', { newIsCap: true, capIsNew: false }],
      'no-underscore-dangle': ['error', { allow: ['__typename'] }],
      'no-var': 'error',
      'prefer-const': 'error',
      'one-var': ['error', 'never'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_$' }],
      'prefer-arrow-callback': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'array-callback-return': 'error',
      'no-param-reassign': ['error', { props: true }],
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'no-object-constructor': 'error',
      'no-array-constructor': 'error',
      'object-shorthand': ['error', 'always'],
      'quote-props': ['error', 'as-needed'],
      'prefer-object-spread': 'error',
      'accessor-pairs': ['error', { setWithoutGet: true }],
      'no-extend-native': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-cond-assign': ['error', 'except-parens'],
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      'guard-for-in': 'error',
      'default-case': 'error',
      'default-case-last': 'error',
      'no-with': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'prefer-promise-reject-errors': 'error',
      'require-atomic-updates': 'error',
      'no-inline-comments': 'error',
    },
  },
  {
    files: ['scripts/preview-*.mjs'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      'scripts/generate-profile.mjs',
      'scripts/languages.mjs',
      'scripts/svg.mjs',
      'test/svg.test.mjs',
    ],
    rules: { 'no-control-regex': 'off' },
  },
  {
    files: ['scripts/activity.mjs', 'test/generate.test.mjs'],
    rules: {
      'no-param-reassign': [
        'error',
        { props: true, ignorePropertyModificationsFor: ['cache'] },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs', '.preview/*.mjs'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'ImportNamespaceSpecifier', message: 'Use named imports.' },
        { selector: 'ExportDefaultDeclaration', message: 'Use named exports.' },
      ],
    },
  },
  prettier,
];
