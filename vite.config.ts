import { createSolidLibViteConfig } from '@jankrajewskiit/configs/vite';
import { defineConfig } from 'vite';

export default defineConfig(async () =>
  createSolidLibViteConfig(
    {},
    {
      fileName: 'velvet-auth',
      externalPackages: ['oidc-client-ts'],
      dts: { tsconfigPath: './tsconfig.app.json' },
    },
  ),
);
