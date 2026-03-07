import type { PayloadHandler } from 'payload'
import { presets, getPreset, presetToPayloadData } from '../presets/index.js'

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
export function createApplyPresetHandler(globalSlug: string): PayloadHandler {
  return async (req) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const body = await req.json?.() as { presetId?: string; languages?: string[] } | undefined
      const presetId = body?.presetId
      const languages = body?.languages || ['fr', 'en']

      if (!presetId) {
        return Response.json({ error: 'Missing presetId' }, { status: 400 })
      }

      const preset = getPreset(presetId)
      if (!preset) {
        return Response.json({ error: `Preset "${presetId}" not found` }, { status: 404 })
      }

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
