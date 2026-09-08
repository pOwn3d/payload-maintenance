import type { PayloadHandler } from 'payload'
import { describe, expect, it } from 'vitest'
import { createMaintenancePageHandler } from '../endpoints/page.js'

/**
 * The page actually served to visitors is this endpoint (the middleware fetches
 * it), not the React component. Its whole renderer is an inline script, so the
 * tests extract that script and exercise its helpers directly: that is the only
 * way to prove the escaping rules on the code path the public really hits.
 */
async function inlineScript(): Promise<string> {
  const handler = createMaintenancePageHandler('/maintenance') as PayloadHandler
  const res = await (handler as unknown as (req: unknown) => Promise<Response>)({})
  const html = await res.text()
  const match = /<script>([\s\S]*?)<\/script>\s*<\/body>/.exec(html)
  if (!match) throw new Error('inline renderer not found in the served page')
  return match[1]!
}

/**
 * Extract one named helper from the inline renderer and evaluate it in
 * isolation, by brace matching on its declaration.
 */
function extractFunction(code: string, name: string): string {
  const start = code.indexOf(`function ${name}(`)
  if (start === -1) throw new Error(`helper "${name}" not found in the served page`)
  let depth = 0
  for (let i = code.indexOf('{', start); i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}') {
      depth--
      if (depth === 0) return code.slice(start, i + 1)
    }
  }
  throw new Error(`helper "${name}" is not balanced`)
}

async function helper(name: string): Promise<(...args: any[]) => string> {
  const code = await inlineScript()
  const source = name === 'cssUrl'
    ? `${extractFunction(code, 'safeUrl')}\n${extractFunction(code, 'cssUrl')}`
    : extractFunction(code, name)
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${source}; return ${name};`)() as (...args: any[]) => string
}

describe('page /maintenance — le script servi est syntaxiquement valide', () => {
  it('se parse', async () => {
    const code = await inlineScript()
    expect(() => new Function(code)).not.toThrow()
  })
})

describe('page /maintenance — échappement des attributs', () => {
  it('échappe le guillemet double, qui permettait de sortir de son attribut', async () => {
    // Régression MNT-06 : esc() sérialisait via textContent/innerHTML, ce qui
    // échappe & < > mais PAS ". Toute valeur injectée dans un attribut entre
    // guillemets (socialLinks[].url, buttonUrl, logoUrl, contactEmail...)
    // s'échappait avec `" onfocus=alert(1) autofocus x="`.
    const esc = await helper('esc')
    expect(esc('" onfocus=alert(1) autofocus x="')).not.toContain('"')
    expect(esc(`'`)).toBe('&#39;')
    expect(esc('<img>')).toBe('&lt;img&gt;')
    expect(esc('a & b')).toBe('a &amp; b')
  })
})

describe('page /maintenance — schémas d URL', () => {
  it('refuse javascript: et data: dans un href ou un src', async () => {
    const safeUrl = await helper('safeUrl')
    expect(safeUrl('javascript:alert(1)')).toBe('')
    expect(safeUrl('  JaVaScRiPt:alert(1)')).toBe('')
    expect(safeUrl('data:text/html;base64,PHN2Zy9vbmxvYWQ9YWxlcnQoMSk+')).toBe('')
    expect(safeUrl('//evil.tld/x')).toBe('')
  })

  it('laisse passer les URL légitimes', async () => {
    const safeUrl = await helper('safeUrl')
    expect(safeUrl('https://example.com/x')).toBe('https://example.com/x')
    expect(safeUrl('http://example.com')).toBe('http://example.com')
    expect(safeUrl('/media/logo.svg')).toBe('/media/logo.svg')
    expect(safeUrl('mailto:a@b.fr', true)).toBe('mailto:a@b.fr')
    expect(safeUrl('mailto:a@b.fr')).toBe('')
  })

  it('refuse une URL qui casserait le url() CSS', async () => {
    const cssUrl = await helper('cssUrl')
    expect(cssUrl('https://x.tld/a.png")%3Bbackground:red%3B"')).toBe('')
    expect(cssUrl('/media/a b.png')).toBe('')
    expect(cssUrl('/media/bg.png')).toBe('/media/bg.png')
  })
})

describe('page /maintenance — couleurs', () => {
  it('rejette tout ce qui n est pas une couleur, au lieu de le concaténer', async () => {
    const col = await helper('col')
    expect(col('#3b82f6', '#000')).toBe('#3b82f6')
    expect(col('rgba(1,2,3,.5)', '#000')).toBe('rgba(1,2,3,.5)')
    expect(col('red', '#000')).toBe('red')
    // accentColor partait dans des gestionnaires inline onmouseenter="…" sans
    // le moindre échappement.
    expect(col("';alert(1);'", '#000')).toBe('#000')
    expect(col('red;background:url(//evil)', '#000')).toBe('#000')
  })
})

describe('page /maintenance — HTML personnalisé', () => {
  it('ne l affecte plus à innerHTML et l isole dans une iframe sans script', async () => {
    // Régression MNT-06 : le rendu public faisait
    // `document.getElementById('app').innerHTML = html` sans assainissement,
    // alors que le composant React appelait un filtre regex contournable par
    // `<svg/onload=…>` (le filtre exigeait un espace avant le gestionnaire).
    const code = await inlineScript()
    expect(code).toContain("frame.setAttribute('sandbox', '')")
    expect(code).toContain('frame.srcdoc = doc')
    expect(code).not.toMatch(/getElementById\('app'\)\.innerHTML\s*=\s*html/)
  })

  it('n injecte plus le CSS personnalisé par concaténation de chaîne', async () => {
    // '</style><img src=x onerror=...>' sortait du bloc <style> et s'exécutait.
    const code = await inlineScript()
    expect(code).not.toContain("'<style>'+data.customCSS+'</style>'")
    expect(code).toContain('customStyle.textContent = data.customCSS')
  })

  it('conserve les échappements de classe de caractères dans le script généré', async () => {
    // Le renderer vit dans un template literal TypeScript : un `\\s` écrit avec
    // un seul antislash y devient un « s » littéral, ce qui casserait
    // silencieusement les filtres. On fige les motifs réellement servis.
    const code = await inlineScript()
    expect(code).toContain("/[\\s\"'<>]/g")
    expect(code).toContain('/^\\/(?!\\/)/')
    expect(code).toContain('/[^\\w \\-]/g')
  })

  it('ne pose plus de gestionnaire d événement inline sur les liens sociaux', async () => {
    const code = await inlineScript()
    expect(code).not.toContain('onmouseenter=')
    expect(code).not.toContain('onmouseleave=')
  })
})
