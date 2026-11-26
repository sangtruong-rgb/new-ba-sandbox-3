// Lint: TypeScript rules and the import rule (no-restricted-imports):
// - a feature never imports another feature;
// - a page never imports another page's feature;
// - nothing outside server/ imports from server/, except a feature's server.ts and a
//   feature's *.test.ts (which may import server/testing.ts).
import tseslint from 'typescript-eslint';

const TS = '{ts,tsx}';
const MAX_DEPTH = 6; // folders inside a feature folder that the rule covers
const up = (n) => `(?:\\.\\./){${n}}`;

const SERVER = { regex: '^(?:\\.\\./)+server(?:/|$)', message: 'Only server/, a feature server.ts or a feature *.test.ts imports server/.' };
const OTHER_FEATURE = 'A feature does not import another feature.';
const OTHER_PAGE_FEATURE = "A page does not import another page's feature.";

/** For a file `depth` folders below a feature of src/pages/<page>/features/<feature>/. */
function pageFeaturePatterns(depth) {
  return [
    { regex: `^${up(depth + 1)}[^./]`, message: OTHER_FEATURE },
    { regex: `^${up(depth + 2)}features(?:/|$)`, message: OTHER_FEATURE },
    { regex: `^${up(depth + 3)}[^./][^/]*/features(?:/|$)`, message: OTHER_FEATURE },
    { regex: `^${up(depth + 4)}features(?:/|$)`, message: OTHER_FEATURE },
    { regex: `^${up(depth + 4)}pages/[^/]+/features(?:/|$)`, message: OTHER_FEATURE },
  ];
}

/** For a file `depth` folders below a feature of src/features/<feature>/. */
function globalFeaturePatterns(depth) {
  return [
    { regex: `^${up(depth + 1)}[^./]`, message: OTHER_FEATURE },
    { regex: `^${up(depth + 2)}features(?:/|$)`, message: OTHER_FEATURE },
    { regex: `^${up(depth + 2)}pages/[^/]+/features(?:/|$)`, message: OTHER_FEATURE },
  ];
}

const restrict = (patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });

const featureBlocks = [];
for (let depth = 0; depth <= MAX_DEPTH; depth++) {
  const sub = '*/'.repeat(depth);
  const pageFiles = `src/pages/*/features/*/${sub}*.${TS}`;
  const globalFiles = `src/features/*/${sub}*.${TS}`;
  featureBlocks.push(
    { files: [pageFiles], rules: restrict([...pageFeaturePatterns(depth), SERVER]) },
    { files: [globalFiles], rules: restrict([...globalFeaturePatterns(depth), SERVER]) },
    // a feature's tests may import server/
    { files: [`src/pages/*/features/*/${sub}*.test.${TS}`], rules: restrict(pageFeaturePatterns(depth)) },
    { files: [`src/features/*/${sub}*.test.${TS}`], rules: restrict(globalFeaturePatterns(depth)) },
  );
}

export default tseslint.config(
  {
    ignores: ['node_modules/', 'data/', 'dist/', 'docs/', 'test-results/', 'playwright-report/'],
  },
  ...tseslint.configs.recommended,
  {
    files: [`**/*.${TS}`],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Tests may reach loosely typed values (configs, fakes).
  { files: [`**/*.test.${TS}`, `**/__tests__/**`, 'e2e/**'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
  // Everything outside server/: no import from server/.
  { files: [`**/*.${TS}`], ignores: ['server/**'], rules: restrict([SERVER]) },
  // A page: no import of another page's feature.
  {
    files: [`src/pages/*/*.${TS}`],
    rules: restrict([{ regex: '^\\.\\./[^./][^/]*/features(?:/|$)', message: OTHER_PAGE_FEATURE }, SERVER]),
  },
  ...featureBlocks,
  // A feature's server.ts may import server/.
  { files: [`src/pages/*/features/*/server.${TS}`], rules: restrict(pageFeaturePatterns(0)) },
  { files: [`src/features/*/server.${TS}`], rules: restrict(globalFeaturePatterns(0)) },
);
