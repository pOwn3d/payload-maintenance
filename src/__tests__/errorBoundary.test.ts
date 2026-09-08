import { isValidElement, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  MaintenanceErrorBoundary,
  type MaintenanceErrorBoundaryProps,
} from '../components/ErrorBoundary.js'

/**
 * La classe est pilotée directement plutôt que montée : `react-dom/server`
 * n'invoque PAS les error boundaries (une exception y remonte au lieu d'être
 * capturée) et le projet n'a pas de DOM de test. Ce que ces cas vérifient est
 * exactement la logique durcie — pas le fait que React sache capturer, ce qui
 * est le travail de React.
 */
function boundary(props: Partial<MaintenanceErrorBoundaryProps> = {}) {
  const instance = new MaintenanceErrorBoundary({
    children: 'contenu',
    ...props,
  } as MaintenanceErrorBoundaryProps)

  // Instance détachée : le `updater` par défaut de React est un no-op qui se
  // contente d'avertir. On applique la mise à jour pour de vrai afin que
  // `reset()` et `componentDidUpdate()` soient testables.
  ;(instance as unknown as { updater: unknown }).updater = {
    enqueueSetState: (inst: typeof instance, partial: unknown) => {
      const next = typeof partial === 'function' ? partial(inst.state) : partial
      inst.state = { ...inst.state, ...(next as object) }
    },
    isMounted: () => true,
    enqueueForceUpdate: () => {},
  }

  return instance
}

/**
 * Aplatit l arbre d éléments en un texte : tout ce qui atteindrait l écran,
 * enfants comme valeurs de props. `react-dom/server` ferait le même travail,
 * mais il n a pas de typage ici (@types/react-dom n est pas installé) et
 * ajouter une dépendance pour un test serait payer cher un aplatissement de
 * six lignes.
 */
function flatten(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (Array.isArray(node)) return node.map(flatten).join(' ')
  if (isValidElement(node)) {
    const props = (node.props ?? {}) as Record<string, unknown>
    return Object.entries(props)
      .map(([key, value]) =>
        key === 'children' ? flatten(value) : `${key}=${flatten(value)}`,
      )
      .join(' ')
  }
  if (typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>)
      .map(([key, value]) => `${key}:${flatten(value)}`)
      .join(' ')
  }
  return String(node)
}

/** Le premier élément de l arbre portant ce rôle ARIA, s il existe. */
function findByRole(node: unknown, role: string): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByRole(child, role)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  const props = (node.props ?? {}) as Record<string, unknown>
  if (props.role === role) return node
  return findByRole(props.children, role)
}

describe('MaintenanceErrorBoundary — fallback', () => {
  it('rend RIEN avec fallback={null}, au lieu du panneau par défaut', () => {
    // Le défaut exact de la boundary d'origine, qui teste `if (this.props.fallback)` :
    // `null` est falsy, donc `fallback={null}` y affiche un pavé d'erreur rouge.
    // Or c'est ce que reçoivent MaintenanceNavLink (rendu sur CHAQUE page de
    // l'admin) et MaintenanceToggle : la dégradation doit être silencieuse.
    const instance = boundary({ fallback: null })
    instance.state = { hasError: true, attempt: 0 }
    expect(instance.render()).toBeNull()
  })

  it('rend le fallback fourni quand il n est pas nul', () => {
    const instance = boundary({ fallback: 'remplacement' })
    instance.state = { hasError: true, attempt: 0 }
    expect(instance.render()).toBe('remplacement')
  })

  it('rend un panneau annoncé (role="alert") quand aucun fallback n est donné', () => {
    const instance = boundary()
    instance.state = { hasError: true, attempt: 0 }
    const panel = findByRole(instance.render(), 'alert')
    expect(panel).not.toBeNull()
    // Le changement est autrement silencieux pour un lecteur d écran, sur le
    // seul écran que l utilisateur voit quand tout le reste a échoué.
    // Anglais ici : sans `document`, `resolveLang()` retombe sur 'en'.
    expect(flatten(panel)).toContain('Retry')
    expect(flatten(panel)).toContain('could not be displayed')
  })

  it('n affiche jamais le message d erreur à l écran, seulement dans la console', () => {
    // Un message d'erreur serveur peut porter un chemin de fichier ou un détail
    // d'implémentation ; l'écran reste générique, la console reçoit tout.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const instance = boundary({ boundaryName: 'MaintenanceNavLink' })
    const secret = 'ENOENT /srv/app/.env.production'

    instance.componentDidCatch(new Error(secret), { componentStack: '' } as never)
    instance.state = { hasError: true, attempt: 0 }

    expect(flatten(instance.render())).not.toContain(secret)
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls[0]?.[0]).toContain('MaintenanceNavLink')
    expect((spy.mock.calls[0]?.[1] as Error).message).toBe(secret)
    spy.mockRestore()
  })
})

describe('MaintenanceErrorBoundary — reprise', () => {
  it('signale l erreur sans conserver l objet Error dans l état', () => {
    expect(MaintenanceErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true })
  })

  it('remonte le sous-arbre au lieu de rejouer l instance qui vient de lever', () => {
    // Le bouton « Réessayer » de la boundary d'origine ne fait que remettre
    // `hasError` à false : React re-rend le MÊME élément avec les MÊMES props,
    // qui lève à nouveau. Ici la `key` change, donc React démonte et reconstruit.
    const instance = boundary()

    const before = instance.render() as ReactElement
    expect(before.key).toBe('0')

    instance.state = { hasError: true, attempt: 0 }
    instance.reset()

    expect(instance.state.hasError).toBe(false)
    const after = instance.render() as ReactElement
    expect(after.key).toBe('1')
    expect(after.key).not.toBe(before.key)
  })

  it('se remet toute seule quand resetKeys change', () => {
    const instance = boundary({ resetKeys: ['/admin/collections/posts'] })
    instance.state = { hasError: true, attempt: 0 }

    // Même valeur : on reste en erreur, sinon la boundary boucle sur un rendu
    // qui échoue à chaque cycle de React.
    instance.componentDidUpdate({
      children: 'contenu',
      resetKeys: ['/admin/collections/posts'],
    } as MaintenanceErrorBoundaryProps)
    expect(instance.state.hasError).toBe(true)

    // Valeur différente : l'entrée a changé, on retente.
    instance.componentDidUpdate({
      children: 'contenu',
      resetKeys: ['/admin/collections/pages'],
    } as MaintenanceErrorBoundaryProps)
    expect(instance.state.hasError).toBe(false)
    expect(instance.state.attempt).toBe(1)
  })

  it('ne remet rien à zéro tant qu aucune erreur n a été capturée', () => {
    const instance = boundary({ resetKeys: ['a'] })
    instance.componentDidUpdate({
      children: 'contenu',
      resetKeys: ['b'],
    } as MaintenanceErrorBoundaryProps)
    expect(instance.state.attempt).toBe(0)
  })
})

describe('points de montage — la boundary est posée DANS le module', () => {
  it('MaintenanceNavLink s enveloppe lui-même, en dégradation silencieuse', async () => {
    // `afterNavLinks` est monté par Payload depuis l'import map : le plugin
    // n'est jamais le parent de ce composant et ne peut donc pas lui poser un
    // ancêtre. La boundary doit vivre à l'intérieur du module, sinon il n'y en
    // a pas — et une exception ici tue TOUTES les pages de l'admin.
    const { MaintenanceNavLink } = await import('../components/MaintenanceNavLink.js')
    const element = MaintenanceNavLink() as ReactElement

    expect(element.type).toBe(MaintenanceErrorBoundary)
    // `null` et pas `undefined` : un pavé d'erreur en travers de la barre
    // latérale sur chaque page serait pire que le lien manquant.
    expect((element.props as { fallback?: unknown }).fallback).toBeNull()
  })

  it('MaintenanceToggle s enveloppe lui-même et transmet ses props', async () => {
    const { MaintenanceToggle } = await import('../components/MaintenanceToggle.js')
    const element = MaintenanceToggle({ basePath: '/api/custom' }) as unknown as ReactElement

    expect(element.type).toBe(MaintenanceErrorBoundary)
    expect((element.props as { fallback?: unknown }).fallback).toBeNull()

    const inner = (element.props as { children: ReactElement }).children
    expect((inner.props as { basePath?: string }).basePath).toBe('/api/custom')
  })
})
