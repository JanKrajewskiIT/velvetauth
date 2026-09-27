import { copyFileSync } from 'node:fs';

copyFileSync('CHANGELOG.md', 'dist/CHANGELOG.md');
