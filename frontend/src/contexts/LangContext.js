import React, { createContext, useContext, useState } from 'react';
import { translations } from '../i18n';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  const t = translations[lang] || translations.en;

  const switchLang = (l) => {
    setLang(l);
    localStorage.setItem('lang', l);
    document.documentElement.setAttribute('dir', translations[l]?.dir || 'ltr');
    document.documentElement.setAttribute('lang', l);
  };

  // Apply on mount
  React.useEffect(() => {
    document.documentElement.setAttribute('dir', t.dir);
    document.documentElement.setAttribute('lang', lang);
  }, [lang, t.dir]);

  return (
    <LangContext.Provider value={{ lang, t, switchLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}
