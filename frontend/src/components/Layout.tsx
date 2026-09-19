import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

function SidebarLink({ label, active }: { label: string; active?: boolean }) {
  return (
    <a
      href="#"
      className={
        active
          ? 'flex items-center gap-3 rounded-lg bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700'
          : 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {label}
    </a>
  )
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
            V
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            VerifyDent
          </span>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          <SidebarLink label="Dashboard" active />

        </nav>
        <div className="mt-auto border-t border-slate-200 p-4">
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-700">
              Dental Practice Demo
            </p>
            <p className="text-xs text-slate-400">Front Desk</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">
              Insurance verification overview
            </p>
          </div>
          <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:inline-block">
            Practice operational
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}