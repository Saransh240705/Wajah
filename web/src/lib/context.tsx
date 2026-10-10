'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Dataset } from '@wajah/shared';

export type Lang = 'en' | 'hi';

interface AppContextValue {
  dataset: Dataset;
  setDataset: (d: Dataset) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleDataset: () => void;
  toggleLang: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDatasetState] = useState<Dataset>('live');
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get('dataset');
    if (d === 'replay' || d === 'live') {
      setDatasetState(d);
    }
    const l = params.get('lang');
    if (l === 'hi' || l === 'en') {
      setLangState(l);
    }
  }, []);

  const setDataset = (d: Dataset) => {
    setDatasetState(d);
    const url = new URL(window.location.href);
    url.searchParams.set('dataset', d);
    window.history.replaceState({}, '', url.toString());
  };

  const setLang = (l: Lang) => {
    setLangState(l);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', l);
    window.history.replaceState({}, '', url.toString());
  };

  const toggleDataset = () => setDataset(dataset === 'live' ? 'replay' : 'live');
  const toggleLang = () => setLang(lang === 'en' ? 'hi' : 'en');

  return (
    <AppContext.Provider
      value={{
        dataset,
        setDataset,
        lang,
        setLang,
        toggleDataset,
        toggleLang,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
