import { useState, useEffect } from 'react';
import { Sun, Moon } from '@phosphor-icons/react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Read what the inline script already applied so toggle starts in sync
    const current = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
    setTheme(current ?? 'dark');
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('shining-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 50,
        width: '2.75rem',
        height: '2.75rem',
        borderRadius: '50%',
        background: 'var(--color-surface)',
        border: '1px solid rgba(184,134,11,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--color-gold)',
        transition: 'background 0.2s, border-color 0.2s, color 0.2s',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-gold)';
        (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(184,134,11,0.35)';
        (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)';
      }}
    >
      <span
        key={theme}
        style={{ display: 'inline-flex', animation: 'theme-spin 0.35s ease-out' }}
      >
        {theme === 'dark' ? <Sun size={18} weight="fill" /> : <Moon size={18} weight="fill" />}
      </span>
      <style>{`
        @keyframes theme-spin {
          from { transform: rotate(-90deg) scale(0.6); opacity: 0; }
          to   { transform: rotate(0deg)  scale(1);   opacity: 1; }
        }
      `}</style>
    </button>
  );
}
