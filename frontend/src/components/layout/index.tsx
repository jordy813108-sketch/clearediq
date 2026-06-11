'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, AlertTriangle, Receipt, Clock,
  BarChart2, Users, Building2, Key, Settings, LogOut, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

const nav = [
  { section: 'Review', items: [
    { href: '/dashboard',          label: 'Dashboard',      icon: LayoutDashboard },
    { href: '/dashboard/flagged',  label: 'Flagged',        icon: AlertTriangle },
    { href: '/dashboard/receipts', label: 'All receipts',   icon: Receipt },
    { href: '/dashboard/pending',  label: 'Pending review', icon: Clock },
  ]},
  { section: 'Analytics', items: [
    { href: '/dashboard/trends',    label: 'Trends',     icon: BarChart2 },
    { href: '/dashboard/employees', label: 'Employees',  icon: Users },
    { href: '/dashboard/merchants', label: 'Merchants',  icon: Building2 },
  ]},
  { section: 'System', items: [
    { href: '/dashboard/api-keys',  label: 'API keys',  icon: Key },
    { href: '/dashboard/settings',  label: 'Settings',  icon: Settings },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  function handleLogout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    router.push('/login');
  }

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col py-5 flex-shrink-0 h-screen sticky top-0">
      <div className="px-4 pb-5 mb-3 border-b border-gray-100">
        <Link href="/dashboard" className="inline-flex">
          <Image src="/clearediq-logo.png" alt="cleaREDiq" width={200} height={60} style={{ objectFit: 'contain' }} />
        </Link>
      </div>
      <nav className="flex-1 px-3 overflow-y-auto">
        {nav.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="px-3 mb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{group.section}</p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link key={href} href={href} className={clsx(
                    'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    active
                      ? 'bg-red-50 text-red-600 font-semibold'
                      : 'text-navy-700 hover:bg-gray-50 hover:text-navy-900'
                  )}>
                    {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-red-500" />}
                    <Icon className={clsx('w-[18px] h-[18px] flex-shrink-0', active ? 'text-red-500' : 'text-gray-400 group-hover:text-navy-700')} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-3 pt-3 mt-1 border-t border-gray-100">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50">
          <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">JL</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-navy-900 truncate leading-tight">Jordan L.</div>
            <div className="text-xs text-gray-400 truncate">Finance admin</div>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-white sticky top-0 z-10">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              {crumb.href ? <Link href={crumb.href} className="hover:text-gray-600">{crumb.label}</Link> : <span className="text-gray-600">{crumb.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-navy-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
