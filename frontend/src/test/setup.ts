import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock react-i18next for component tests
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
      exists: () => true,
    },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))
