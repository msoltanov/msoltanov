export default {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
  semi: true,
  singleQuote: true,
  bracketSameLine: true,
  htmlWhitespaceSensitivity: 'css',
  overrides: [
    { files: '*.md', options: { proseWrap: 'always' } },
    { files: '*.json', options: { bracketSpacing: false } },
    { files: ['*.yml', '*.yaml'], options: { singleQuote: false } },
  ],
};
