import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Moon, Palette, Sun, X } from 'lucide-react'
import { useThemeStore, type ThemeMode } from '../stores/theme'

const PRESET_COLORS = [
  '#f9fafb', '#ffffff', '#f3f4f6', '#eff6ff', '#f0fdf4',
  '#fef2f2', '#fdf4ff', '#fefce8', '#ecfeff', '#f5f3ff',
  '#fff7ed', '#f8fafc', '#f0f9ff', '#fdf2f8',
]

const PRESET_GRADIENTS = [
  { value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', label: 'Purple Blue' },
  { value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', label: 'Pink Red' },
  { value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', label: 'Blue Cyan' },
  { value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', label: 'Green Teal' },
  { value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', label: 'Pink Yellow' },
  { value: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', label: 'Lavender Pink' },
  { value: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)', label: 'Orange Purple' },
  { value: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)', label: 'Light Purple Blue' },
]

export default function ThemeSwitcher() {
  const { t } = useTranslation()
  const { mode, color, gradient, imageUrl, darkMode, setColor, setGradient, setImageUrl, setMode, toggleDarkMode, reset } = useThemeStore()
  const [open, setOpen] = useState(false)
  const [urlInput, setUrlInput] = useState(imageUrl)

  const tabs: { key: ThemeMode; label: string }[] = [
    { key: 'color', label: t('theme.solidColor') },
    { key: 'gradient', label: t('theme.gradient') },
    { key: 'image', label: t('theme.backgroundImage') },
  ]

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-white dark:bg-card p-3 shadow-lg border border-gray-200 dark:border-border hover:shadow-xl transition-shadow"
        title={t('theme.title')}
      >
        <Palette size={20} className="text-gray-600" />
      </button>

      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 rounded-lg bg-white dark:bg-card shadow-xl border border-gray-200 dark:border-border">
          <div className="flex items-center justify-between border-b dark:border-border px-4 py-3">
            <span className="font-semibold text-sm text-gray-900 dark:text-foreground">{t('theme.title')}</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:hover:text-foreground">
              <X size={16} />
            </button>
          </div>

          <div className="flex border-b">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMode(tab.key)}
                className={`flex-1 py-2 text-xs font-medium ${
                  mode === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3 max-h-72 overflow-auto">
            {mode === 'color' && (
              <ColorPanel current={color} onSelect={setColor} t={t} />
            )}
            {mode === 'gradient' && (
              <GradientPanel current={gradient} onSelect={setGradient} />
            )}
            {mode === 'image' && (
              <ImagePanel
                urlInput={urlInput}
                onUrlChange={setUrlInput}
                onApply={() => { setImageUrl(urlInput) }}
                t={t}
              />
            )}
          </div>

          <div className="border-t px-4 py-3 space-y-2">
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              {darkMode ? t('theme.lightMode') : t('theme.darkMode')}
            </button>
            <button
              onClick={() => { reset(); setUrlInput('') }}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              {t('theme.reset')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function ColorPanel({ current, onSelect, t }: { current: string; onSelect: (c: string) => void; t: (k: string) => string }) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-2 mb-3">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: c,
              borderColor: current === c ? '#3b82f6' : c === '#ffffff' ? '#e5e7eb' : c,
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">{t('theme.customColor')}</label>
        <input
          type="color"
          value={current}
          onChange={(e) => onSelect(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
        />
      </div>
    </div>
  )
}

function GradientPanel({ current, onSelect }: { current: string; onSelect: (g: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PRESET_GRADIENTS.map((g) => (
        <button
          key={g.value}
          onClick={() => onSelect(g.value)}
          className={`rounded-lg overflow-hidden border-2 transition-transform hover:scale-105 ${
            current === g.value ? 'border-blue-500' : 'border-gray-200'
          }`}
        >
          <div className="h-10" style={{ backgroundImage: g.value }} />
          <div className="px-2 py-1 text-xs text-gray-600 bg-white">{g.label}</div>
        </button>
      ))}
    </div>
  )
}

function ImagePanel({
  urlInput, onUrlChange, onApply, t,
}: {
  urlInput: string; onUrlChange: (v: string) => void; onApply: () => void; t: (k: string) => string
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs text-gray-500 dark:text-muted-foreground">{t('theme.customUrl')}</label>
      <input
        type="text"
        value={urlInput}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="https://example.com/bg.jpg"
        className="w-full rounded-md border border-gray-300 dark:border-border bg-background dark:text-foreground px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <button
        onClick={onApply}
        className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {t('theme.apply')}
      </button>
    </div>
  )
}
