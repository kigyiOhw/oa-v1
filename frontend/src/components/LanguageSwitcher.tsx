import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const { t } = useTranslation()

  const toggle = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
  }

  return (
    <button
      onClick={toggle}
      className="rounded-md border px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
      title={i18n.language === 'zh' ? t('common.switchToEnglish') : t('common.switchToChinese')}
    >
      {t('common.langLabel')}
    </button>
  )
}
