'use client'

// Thin wrapper: re-export from package client entry to preserve RSC boundary.
// tsup keeps '@consilioweb/payload-maintenance/client' external in the views bundle,
// so Next.js correctly treats this as a client component.
// @ts-ignore — self-reference via package exports
export { MaintenanceViewClient, MaintenanceErrorBoundary } from '@consilioweb/payload-maintenance/client'
