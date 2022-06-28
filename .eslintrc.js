module.exports = {
  root: true,
  env: {
    node: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
    'eslint:recommended',
    'plugin:vue/recommended',
    '@vue/prettier',
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'vue/require-default-prop': 'off',
    // --------------------------------------------
    // no-unresolved is because eslint can't deal with our @ import alias.
    // Apparently eslint resolvers
    // (https://github.com/import-js/eslint-plugin-import#resolvers) can help
    // with this, but I haven't tried.
    'import/no-unresolved': 'off',
    // --------------------------------------------
    'import/extensions': 'off',
    'no-var': 2,
    'prefer-const': 2,
    'no-use-before-define': 'off',
    'no-param-reassign': ['error', { 'props': false }],
    'no-underscore-dangle': 'off',
    'func-names': 'off',
    'consistent-return': 'off',
    'no-bitwise': ["error", { "allow": ["~"] }],
    'no-continue': 'off',
    // FIXME fix these issues and remove rule overrides
    'no-return-assign': 'off',
    'no-restricted-syntax': 'off',
    'no-await-in-loop': 'off',
  },
}
