export type Theme = 'light' | 'dark' | 'system'
export const themeStorageKey = 'moveon:theme'

export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(themeStorageKey)
    if (value === 'light' || value === 'dark') return value
  } catch {
    /* Theme still works when storage is unavailable. */
  }
  return 'system'
}

export function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#15221d' : '#f7f6f0')
}
