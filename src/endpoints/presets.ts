import type { PayloadHandler } from 'payload'
import { presets, getPreset, presetToPayloadData } from '../presets/index.js'
import { isMaintenanceAdmin, unauthorizedResponse, type AdminAccessOptions } from '../utils/access.js'

/**
 * List all available presets.
 */
export function createPresetsListHandler(): PayloadHandler {
  return async () => {
    return Response.json({
      presets: presets.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        preview: p.preview,
        template: p.config.template,
      })),
    })
  }
}

/**
 * Apply a preset to the maintenance global (admin only).
 */
export function createApplyPresetHandler(
  globalSlug: string,
  adminOptions: AdminAccessOptions = {},
): PayloadHandler {
  return async (req) => {
    if (!(await isMaintenanceAdmin(req, adminOptions))) {
      return unauthorizedResponse()
    }

    try {
      const body = await req.json?.() as { presetId?: string; languages?: string[] } | undefined
      const presetId = body?.presetId
      const languages = body?.languages || ['fr', 'en']

      if (!presetId || typeof presetId !== 'string') {
        return Response.json({ error: 'Missing presetId' }, { status: 400 })
      }

      // Validate presetId format: only alphanumeric, hyphens, underscores (max 64 chars)
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(presetId)) {
        return Response.json({ error: 'Invalid presetId format' }, { status: 400 })
      }

      // Validate presetId exists in the known preset list
      const validIds = presets.map((p) => p.id)
      if (!validIds.includes(presetId)) {
        return Response.json(
          { error: `Unknown presetId "${presetId}". Valid presets: ${validIds.join(', ')}` },
          { status: 400 },
        )
      }

      const preset = getPreset(presetId)!


      const data = presetToPayloadData(preset, languages)

      await req.payload.updateGlobal({
        slug: globalSlug,
        data: data as any,
        overrideAccess: true,
      })

      return Response.json({
        success: true,
        preset: presetId,
        message: `Preset "${preset.name.fr}" applied`,
      })
    } catch (error) {
      return Response.json(
        { error: 'Failed to apply preset' },
        { status: 500 },
      )
    }
  }
}
