import { createLintStagedConfig } from '@jankrajewskiit/configs/lint-staged';

const config = createLintStagedConfig();
delete config['*.css'];

export default config;
