'use client';

import { ReactNode, useEffect, useState } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage first, then system preference
    const stored = localStorage.getItem('theme');
    let prefersDark = false;

    if (stored === 'dark') {
      prefersDark = true;
    } else if (stored === 'light') {
      prefersDark = false;
    } else {
      // No stored preference, check system
      prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    setIsDark(prefersDark);
    applyTheme(prefersDark);
  }, []);

  const applyTheme = (dark: boolean) => {
    const html = document.documentElement;
    // Always remove both, then add the correct one - ensures explicit theme always wins
    html.classList.remove('dark', 'light');
    html.classList.add(dark ? 'dark' : 'light');
    html.style.colorScheme = dark ? 'dark' : 'light';
  };

  const toggleTheme = () => {
    const newState = !isDark;
    setIsDark(newState);
    applyTheme(newState);
    localStorage.setItem('theme', newState ? 'dark' : 'light');
    // Dispatch custom event for any components that need to react
    window.dispatchEvent(new CustomEvent('theme-change', { detail: { isDark: newState } }));
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <>
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      {children}
    </>
  );
}

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="fixed top-4 right-4 z-50 p-2.5 rounded-lg bg-accent text-accent-foreground hover:opacity-90 transition-all duration-200 shadow-lg"
      aria-label="Toggle dark mode"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM4.22 4.22a1 1 0 011.415 0l1.414 1.414a1 1 0 01-1.414 1.415L4.22 5.636a1 1 0 010-1.414zm11.313 0a1 1 0 010 1.414l-1.414 1.414a1 1 0 01-1.415-1.415l1.414-1.414a1 1 0 011.415 0zM10 7a3 3 0 100 6 3 3 0 000-6zm0 2a1 1 0 100 2 1 1 0 000-2zm8 4a1 1 0 11-2 0 1 1 0 012 0zm2-4a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}
