'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '../lib/context';
import { t } from '../lib/i18n';

export function Header() {
  const pathname = usePathname();
  const { dataset, setDataset, lang, setLang } = useApp();

  // Hide nav on standalone field view
  if (pathname?.startsWith('/work-order/')) {
    return null;
  }

  const navItems = [
    { href: '/board', key: 'nav_board', label: t('nav_board', lang) },
    { href: '/map', key: 'nav_map', label: t('nav_map', lang) },
    { href: '/ledger', key: 'nav_ledger', label: t('nav_ledger', lang) },
    { href: '/ask', key: 'nav_ask', label: t('nav_ask', lang) },
  ];

  const isCurrent = (href: string) => {
    if (href === '/board' && (pathname === '/' || pathname === '/board')) return true;
    return pathname.startsWith(href);
  };

  return (
    <header className="w-full bg-paper border-b border-ink sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Brand Nameplate + Desktop Nav */}
        <div className="flex items-center gap-8">
          <Link
            href="/board"
            className="font-slab text-2xl sm:text-3xl font-normal tracking-tight text-ink hover:opacity-80 transition-opacity"
          >
            Wajah
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-sans font-medium text-ink">
            {navItems.map((item) => {
              const active = isCurrent(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`py-1 transition-colors hover:text-ink-2 ${
                    active ? 'font-bold border-b-2 border-ink' : 'text-ink-2'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Live/Replay switch + Language switch */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 border-r border-rule pr-4">
            <button
              onClick={() => setDataset('live')}
              className={`px-1.5 py-0.5 transition-all ${
                dataset === 'live'
                  ? 'font-bold underline text-ink'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              {t('live', lang)}
            </button>
            <span className="text-ink-3">/</span>
            <button
              onClick={() => setDataset('replay')}
              className={`px-1.5 py-0.5 transition-all ${
                dataset === 'replay'
                  ? 'font-bold underline text-ink'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              {t('replay', lang)}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLang('en')}
              className={`px-1.5 py-0.5 transition-all ${
                lang === 'en'
                  ? 'font-bold underline text-ink'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              EN
            </button>
            <span className="text-ink-3">|</span>
            <button
              onClick={() => setLang('hi')}
              className={`px-1.5 py-0.5 transition-all ${
                lang === 'hi'
                  ? 'font-bold underline text-ink'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              हिं
            </button>
          </div>
        </div>
      </div>

      {/* Persistent Replay Strip Banner */}
      {dataset === 'replay' && (
        <div className="w-full bg-paper border-t border-dashed border-ink py-1 px-4 text-center text-xs font-mono font-bold tracking-wider text-ink flex items-center justify-center gap-2">
          <span>⟲</span>
          <span>{t('replay_banner', lang)}</span>
        </div>
      )}
    </header>
  );
}
