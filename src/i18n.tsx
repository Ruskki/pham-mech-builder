import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface LanguageDef {
  code: string;
  label: string;
}

export const LANGUAGES: LanguageDef[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

export const DEFAULT_LANG = 'en';
export type Language = string;

interface LangContextValue {
  lang: Language;
  setLang: (l: Language) => void;
}

const STORAGE_KEY = 'pham-mech-builder-lang';

const LangContext = createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
});

export function useLang() {
  return useContext(LangContext);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && LANGUAGES.some(l => l.code === stored)) return stored;
    } catch {}
    return DEFAULT_LANG;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  }, [lang]);

  const setLang = (l: Language) => {
    if (LANGUAGES.some(def => def.code === l)) setLangState(l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}
