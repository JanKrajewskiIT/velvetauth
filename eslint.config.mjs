import { createEslintConfig } from '@jankrajewskiit/configs/eslint';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  environments: ['browser'],
  ignorePaths: ['.agents/**', '.claude/**', '.codex/**', '.cursor/**'],
});
