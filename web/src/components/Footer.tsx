'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '../lib/context';

export function Footer() {
  const pathname = usePathname();
  const { lang } = useApp();

  if (pathname?.startsWith('/work-order/')) {
    return null;
  }

  return (
    <footer className="w-full bg-paper border-t border-rule mt-16 pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-sans text-ink-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            {lang === 'hi' ? 'डेटा स्रोत:' : 'Data sources:'} CPCB / OpenAQ · Open-Meteo · NASA FIRMS · © OpenStreetMap
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/method"
            className="font-mono underline text-ink hover:text-ink-2 transition-colors font-semibold"
          >
            {lang === 'hi' ? 'वाज़ेह विधि एवं सीमाएं' : 'How Wajah diagnoses and measures'}
          </Link>
        </div>
      </div>
    </footer>
  );
}
