'use client';

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('omdb-theme', next); } catch {}
  }
  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle light/dark mode" title="Toggle light/dark mode">
      <span className="theme-toggle__icon" aria-hidden>◐</span>
    </button>
  );
}
