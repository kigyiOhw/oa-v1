import { create } from 'zustand'

export type ThemeMode = 'color' | 'gradient' | 'image'

const STORAGE_KEY = 'theme_settings'

interface ThemeState {
  mode: ThemeMode
  color: string
  gradient: string
  imageUrl: string
  darkMode: boolean
  setMode: (mode: ThemeMode) => void
  setColor: (color: string) => void
  setGradient: (gradient: string) => void
  setImageUrl: (url: string) => void
  toggleDarkMode: () => void
  reset: () => void
}

const DEFAULTS = {
  mode: 'color' as ThemeMode,
  color: '#f9fafb',
  gradient: '',
  imageUrl: '',
  darkMode: false,
}

function load(): typeof DEFAULTS {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        mode: p.mode ?? DEFAULTS.mode,
        color: p.color ?? DEFAULTS.color,
        gradient: p.gradient ?? DEFAULTS.gradient,
        imageUrl: p.imageUrl ?? DEFAULTS.imageUrl,
        darkMode: p.darkMode ?? DEFAULTS.darkMode,
      }
    }
  } catch { /* ignore */ }
  return DEFAULTS
}

function persist(state: typeof DEFAULTS) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const saved = load()
  return {
    ...saved,

    setMode: (mode: ThemeMode) => {
      set({ mode })
      const s = get()
      persist({ mode: s.mode, color: s.color, gradient: s.gradient, imageUrl: s.imageUrl, darkMode: s.darkMode })
    },

    setColor: (color: string) => {
      set({ color, mode: 'color' })
      const s = get()
      persist({ mode: s.mode, color: s.color, gradient: s.gradient, imageUrl: s.imageUrl, darkMode: s.darkMode })
    },

    setGradient: (gradient: string) => {
      set({ gradient, mode: 'gradient' })
      const s = get()
      persist({ mode: s.mode, color: s.color, gradient: s.gradient, imageUrl: s.imageUrl, darkMode: s.darkMode })
    },

    setImageUrl: (imageUrl: string) => {
      set({ imageUrl, mode: 'image' })
      const s = get()
      persist({ mode: s.mode, color: s.color, gradient: s.gradient, imageUrl: s.imageUrl, darkMode: s.darkMode })
    },

    toggleDarkMode: () => {
      const next = !get().darkMode
      set({ darkMode: next })
      const s = get()
      persist({ mode: s.mode, color: s.color, gradient: s.gradient, imageUrl: s.imageUrl, darkMode: s.darkMode })
    },

    reset: () => {
      set(DEFAULTS)
      persist(DEFAULTS)
    },
  }
})
