export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-order'],
  rules: {
    'selector-class-pattern':
      '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$',
    'custom-property-pattern': '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$',
    'keyframes-name-pattern': '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$',
    'selector-max-id': 0,
    'selector-max-universal': 0,
    'selector-max-type': [0, { ignore: ['descendant'] }],
    'selector-max-attribute': 1,
    'selector-attribute-name-disallowed-list': ['class'],
    'max-nesting-depth': [
      1,
      { ignore: ['blockless-at-rules', 'pseudo-classes'] },
    ],
    'order/properties-alphabetical-order': true,
    'declaration-block-no-redundant-longhand-properties': null,
    'declaration-block-no-duplicate-properties': true,
    'color-hex-length': 'short',
    'color-named': 'never',
    'length-zero-no-unit': true,
    'declaration-property-unit-disallowed-list': {
      'font-size': ['px'],
      'line-height': ['px', 'em', 'rem'],
    },
    'declaration-no-important': true,
    'import-notation': 'string',
  },
  overrides: [
    { files: ['.preview/preview.css'], rules: { 'selector-max-type': null } },
  ],
  ignoreFiles: ['node_modules/**', 'assets/**', 'output/**'],
};
