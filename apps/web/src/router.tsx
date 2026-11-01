import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router'
import { Family } from '@/routes/Family'
import { Home } from '@/routes/Home'
import { Learn } from '@/routes/Learn'

const root = createRootRoute({
  component: () => (
    <div className="mx-auto min-h-screen max-w-6xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold">Arandu</Link>
        <nav aria-label="Principal" className="flex gap-2">
          <Link to="/aprender" className="inline-flex min-h-12 items-center rounded-lg px-4 font-semibold underline [&.active]:bg-secondary">Aprender</Link>
          <Link to="/familia" className="inline-flex min-h-12 items-center rounded-lg px-4 font-semibold underline [&.active]:bg-secondary">Familia</Link>
        </nav>
      </header>
      <main><Outlet /></main>
    </div>
  ),
})

const routeTree = root.addChildren([
  createRoute({ getParentRoute: () => root, path: '/', component: Home }),
  createRoute({ getParentRoute: () => root, path: '/aprender', component: Learn }),
  createRoute({ getParentRoute: () => root, path: '/familia', component: Family }),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
