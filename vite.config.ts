import { createSolidLibViteConfig } from '@jankrajewskiit/configs/vite';
import { defineConfig } from 'vite';

export default defineConfig(async () =>
  createSolidLibViteConfig(
    {},
    {
      entry: 'src/index.ts',
      fileName: 'index',
      externalizeFromPackageJson: true,
      preserveModules: false,
    },
  ),
);
