import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { expenseApi } from '../../api/expense'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export default function ExpenseCreate() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const EXPENSE_TYPE_OPTIONS = [
    { value: 'travel', label: t('expense.typeLabels.travel') },
    { value: 'office', label: t('expense.typeLabels.office') },
    { value: 'entertainment', label: t('expense.typeLabels.entertainment') },
    { value: 'other', label: t('expense.typeLabels.other') },
  ]

  const [expenseType, setExpenseType] = useState('travel')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [attachmentUrls, setAttachmentUrls] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    expenseApi.getById(Number(id)).then((res) => {
      const e = res.data
      setExpenseType(e.expense_type)
      setAmount(String(e.amount))
      setDescription(e.description)
      setAttachmentUrls((e.attachment_urls || []).join('\n'))
    }).catch(() => navigate('/expenses'))
  }, [id])

  const buildData = () => {
    const urls = attachmentUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0)
    return {
      expense_type: expenseType,
      amount: parseFloat(amount),
      description,
      attachment_urls: urls.length > 0 ? urls : null,
    }
  }

  const handleSaveDraft = async () => {
    if (!amount || !description) {
      alert(t('common.requiredFields'))
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await expenseApi.update(Number(id), buildData())
      } else {
        await expenseApi.create(buildData())
      }
      navigate('/expenses')
    } catch { /* handled by axios interceptor */ }
    finally { setSaving(false) }
  }

  const handleSubmit = async () => {
    if (!amount || !description) {
      alert(t('common.requiredFields'))
      return
    }
    setSaving(true)
    try {
      let expenseId = Number(id)
      if (isEdit) {
        await expenseApi.update(Number(id), buildData())
      } else {
        const res = await expenseApi.create(buildData())
        expenseId = res.data.id
      }
      await expenseApi.submit(expenseId)
      navigate('/expenses')
    } catch { /* handled by axios interceptor */ }
    finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? t('expense.editExpense') : t('expense.newExpense')}</h1>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('expense.expenseType')}</label>
          <Select
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value)}
          >
            {EXPENSE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('expense.amount')} (¥)</label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('expense.description')}</label>
          <Textarea
            rows={4}
            placeholder={t('expense.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('expense.attachmentUrls')}</label>
          <Textarea
            rows={3}
            placeholder={t('expense.attachmentUrlsPlaceholder')}
            value={attachmentUrls}
            onChange={(e) => setAttachmentUrls(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" disabled={saving} onClick={handleSaveDraft}>
            {saving ? t('common.saving') : t('expense.saveDraft')}
          </Button>
          <Button disabled={saving} onClick={handleSubmit}>
            {saving ? t('common.processing') : t('expense.submitApproval')}
          </Button>
          <Button variant="link" className="h-auto p-0" onClick={() => navigate('/expenses')}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
