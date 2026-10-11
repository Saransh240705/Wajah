'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '../lib/context';
import { t } from '../lib/i18n';

export function BottomNav() {
  const pathname = usePathname();
  const { lang } = useApp();

  // Hide on field view
  if (pathname?.startsWith('/work-order/')) {
    return null;
  }

  const navItems = [
    { href: '/board', label: t('nav_board', lang), icon: '☰' },
    { href: '/map', label: t('nav_map', lang), icon: '◫' },
    { href: '/ledger', label: t('nav_ledger', lang), icon: '⊞' },
    { href: '/ask', label: t('nav_ask', lang), icon: '💬' },
  ];

  const isCurrent = (href: string) => {
    if (href === '/board' && (pathname === '/' || pathname === '/board')) return true;
    return pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-paper border-t border-ink z-50 grid grid-cols-4">
      {navItems.map((item) => {
        const active = isCurrent(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center transition-colors ${
              active
                ? 'bg-ink text-paper font-bold'
                : 'bg-paper text-ink hover:bg-fill/30 font-medium'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-xs font-sans mt-1 leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
