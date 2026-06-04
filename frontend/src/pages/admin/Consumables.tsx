import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { consumableApi, type ConsumableItem } from '../../api/consumables'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Consumables() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<ConsumableItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const fetchItems = useCallback(async () => {
    const res = await consumableApi.list({
      page,
      page_size: 20,
      search: search || undefined,
    })
    setItems(res.data.items)
    setTotal(res.data.total)
  }, [page, search])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDelete = async (id: number) => {
    if (!confirm(t('consumable.deleteConfirm'))) return
    try {
      await consumableApi.delete(id)
      fetchItems()
    } catch { /* handled by axios */ }
  }

  const isLowStock = (item: ConsumableItem) => item.current_stock <= item.safety_stock

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('consumable.title')}</h1>
        <Link to="/admin/consumables/new">
          <Button size="sm">+ {t('consumable.createConsumable')}</Button>
        </Link>
      </div>

      <div className="mb-4">
        <Input
          type="text"
          placeholder={t('common.search') + '...'}
          className="w-56"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('consumable.consumableName')}</TableHead>
            <TableHead>{t('consumable.category')}</TableHead>
            <TableHead>{t('consumable.unit')}</TableHead>
            <TableHead>{t('consumable.currentStock')}</TableHead>
            <TableHead>{t('consumable.safetyStock')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className={isLowStock(item) ? 'bg-red-50' : ''}>
              <TableCell>
                {item.name}
                {isLowStock(item) && (
                  <span className="ml-2 text-xs text-red-600 font-medium">{t('consumable.lowStock')}</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{item.category && (item.category as any).name ? (item.category as any).name : '-'}</TableCell>
              <TableCell>{item.unit}</TableCell>
              <TableCell className={`font-medium ${isLowStock(item) ? 'text-red-600' : ''}`}>{item.current_stock}</TableCell>
              <TableCell className="text-muted-foreground">{item.safety_stock}</TableCell>
              <TableCell className="space-x-2">
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/admin/consumables/${item.id}`)}>
                  {t('common.view')}
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/admin/consumables/${item.id}/edit`)}>
                  {t('common.edit')}
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleDelete(item.id)}>
                  {t('common.delete')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>{t('common.total')}: {total}</span>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          {t('common.prev')}
        </Button>
        <span>{t('common.page')} {page}</span>
        <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
          {t('common.next')}
        </Button>
      </div>
    </div>
  )
}
