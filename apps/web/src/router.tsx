import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router'
import { Family } from '@/routes/Family'
import { Home } from '@/routes/Home'
import { Learn } from '@/routes/Learn'
import { SignIn } from '@/routes/SignIn'

const navLink = 'inline-flex min-h-12 items-center rounded-lg px-3 font-semibold underline sm:px-4 [&.active]:bg-secondary'

const root = createRootRoute({
  component: () => (
    <div className="mx-auto min-h-screen max-w-6xl p-4">
      <a href="#main" className="sr-only focus:not-sr-only">Saltar al contenido</a>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/" className="text-2xl font-bold">Arandu</Link>
        <nav aria-label="Principal" className="flex gap-1">
          <Link to="/aprender" className={navLink}>Aprender</Link>
          <Link to="/familia" className={navLink}>Familia</Link>
        </nav>
      </header>
      <main id="main"><Outlet /></main>
    </div>
  ),
})

const routeTree = root.addChildren([
  createRoute({ getParentRoute: () => root, path: '/', component: Home }),
  createRoute({ getParentRoute: () => root, path: '/entrar', component: SignIn }),
  createRoute({
    getParentRoute: () => root,
    path: '/aprender',
    component: Learn,
    // `?mision=foto` opens the optional photo mission instead of the planner's pick
    validateSearch: (s: Record<string, unknown>): { mision?: 'foto' } => (s.mision === 'foto' ? { mision: 'foto' } : {}),
  }),
  createRoute({ getParentRoute: () => root, path: '/familia', component: Family }),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
