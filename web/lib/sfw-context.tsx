'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface SfwContextType {
  sfwMode: boolean;
  setSfwMode: (value: boolean) => void;
}

const SfwContext = createContext<SfwContextType>({ sfwMode: true, setSfwMode: () => {} });

export function SfwProvider({ children }: { children: ReactNode }) {
  const [sfwMode, setSfwModeState] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('sfw_mode');
    if (stored !== null) setSfwModeState(stored === 'true');
  }, []);

  function setSfwMode(value: boolean) {
    setSfwModeState(value);
    localStorage.setItem('sfw_mode', String(value));
  }

  return (
    <SfwContext.Provider value={{ sfwMode, setSfwMode }}>
      {children}
    </SfwContext.Provider>
  );
}

export function useSfw() {
  return useContext(SfwContext);
}
