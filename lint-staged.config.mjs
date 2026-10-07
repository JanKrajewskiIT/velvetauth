import { createLintStagedConfig } from '@jankrajewskiit/configs/lint-staged';

const config = createLintStagedConfig();
// No CSS is shipped, so the factory's Stylelint entry has nothing to lint.
delete config['*.css'];

export default config;
