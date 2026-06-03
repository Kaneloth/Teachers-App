/**
 * Call this once, as early as possible in main.tsx / App.tsx (before React renders),
 * so dark mode and text size are applied before the first paint — preventing flicker.
 *
 * Example usage in main.tsx:
 *   import { applyStoredPreferences } from './themeInit';
 *   applyStoredPreferences();
 *   ReactDOM.createRoot(...).render(<App />);
 */

const TEXT_SIZES: Record<string, string> = {
  Small: '13px',
  Medium: '16px',
  Large: '19px',
};

export function applyStoredPreferences(): void {
  try {
    const dark = localStorage.getItem('crosssa_dark_mode') === '1';
    document.documentElement.classList.toggle('dark', dark);

    const size = localStorage.getItem('crosssa_text_size');
    if (size && TEXT_SIZES[size]) {
      document.documentElement.style.fontSize = TEXT_SIZES[size];
    }
  } catch {
    // localStorage unavailable (private browsing edge case) — silently ignore
  }
}
