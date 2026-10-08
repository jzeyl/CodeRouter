import { useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { applyTheme, readTheme, themeStorageKey, type Theme } from '@/lib/theme'

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const Icon = options.find((option) => option.value === theme)!.icon
  useEffect(() => {
    applyTheme(theme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => applyTheme(theme)
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [theme])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === themeStorageKey || event.key === null) setTheme(readTheme())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const select = (value: string) => {
    const next = value as Theme
    setTheme(next)
    try {
      localStorage.setItem(themeStorageKey, next)
    } catch {
      /* Non-persistent fallback. */
    }
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="theme-trigger"
        aria-label={`Appearance: ${theme}. Change theme`}
      >
        <Icon size={19} aria-hidden="true" />
        <span className="theme-label">Appearance</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="theme-menu" align="end" sideOffset={10}>
          <DropdownMenu.Label className="theme-menu-label">
            Make yourself comfortable
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={theme} onValueChange={select}>
            {options.map(({ value, label, icon: OptionIcon }) => (
              <DropdownMenu.RadioItem className="theme-option" key={value} value={value}>
                <OptionIcon size={17} aria-hidden="true" />
                <span>{label}</span>
                <DropdownMenu.ItemIndicator className="theme-check">
                  <Check size={16} aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
