import { defineConfig, type Options } from 'tsup'
import { writeFileSync, readFileSync, rmSync } from 'fs'

const CLIENT_BANNER = '"use client";\n'

const externals = [
  'payload',
  'payload/shared',
  '@payloadcms/ui',
  '@payloadcms/translations',
  '@payloadcms/next',
  '@payloadcms/next/templates',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'next',
  'next/navigation',
  'next/link',
  'next/server',
  'next/headers',
  '@consilioweb/payload-maintenance',
  '@consilioweb/payload-maintenance/client',
]

// Clean dist once before parallel builds start
rmSync('dist', { recursive: true, force: true })

const sharedConfig: Partial<Options> = {
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  external: externals,
  clean: false,
}

export default defineConfig([
  // Server entry — plugin + types + globals + endpoints
  {
    ...sharedConfig,
    entry: { index: 'src/index.ts' },
  },
  // Client entry — React components
  {
    ...sharedConfig,
    entry: { client: 'src/client.ts' },
    onSuccess: async () => {
      for (const file of ['dist/client.js', 'dist/client.cjs']) {
        const content = readFileSync(file, 'utf-8')
        writeFileSync(file, CLIENT_BANNER + content)
      }
    },
  },
  // Views entry — server components with DefaultTemplate
  {
    ...sharedConfig,
    entry: { views: 'src/views.ts' },
  },
  // Middleware entry — Next.js middleware helper
  {
    ...sharedConfig,
    entry: { middleware: 'src/middleware.ts' },
  },
])
