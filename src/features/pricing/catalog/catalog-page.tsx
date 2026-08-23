import { FolderPlus, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, PageHeader, selectClassName, TableSkeleton } from '@/features/pricing/components/operational-ui'
import { useOnlineStatus } from '@/hooks/use-online-status'

import { CatalogCategoryForm } from './catalog-category-form'
import { CatalogItemForm } from './catalog-item-form'
import {
  useCatalogCategories,
  useCatalogItems,
  useCreateCatalogCategory,
  useCreateCatalogItem,
  useSetCatalogCategoryStatus,
  useSetCatalogItemStatus,
  useUpdateCatalogCategory,
  useUpdateCatalogItem,
} from './catalog.queries'
import { CatalogCategoriesTable, CatalogItemsTable } from './catalog-tables'
import type { CatalogCategoryInput, CatalogCategoryRow, CatalogItemInput, CatalogItemRow } from './catalog.types'

type Area = 'items' | 'categories'
type StatusFilter = 'all' | 'active' | 'inactive'

function matchesStatus(active: boolean, filter: StatusFilter) {
  return filter === 'all' || (filter === 'active' ? active : !active)
}

export default function CatalogPage() {
  const online = useOnlineStatus()
  const [area, setArea] = useState<Area>('items')
  const [itemSearch, setItemSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [itemCategory, setItemCategory] = useState('all')
  const [itemStatus, setItemStatus] = useState<StatusFilter>('active')
  const [categoryStatus, setCategoryStatus] = useState<StatusFilter>('active')
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false)
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogItemRow | null>(null)
  const [editingCategory, setEditingCategory] = useState<CatalogCategoryRow | null>(null)

  const itemsQuery = useCatalogItems()
  const categoriesQuery = useCatalogCategories()
  const createItem = useCreateCatalogItem()
  const updateItem = useUpdateCatalogItem()
  const setItemStatusMutation = useSetCatalogItemStatus()
  const createCategory = useCreateCatalogCategory()
  const updateCategory = useUpdateCatalogCategory()
  const setCategoryStatusMutation = useSetCatalogCategoryStatus()

  const categories = categoriesQuery.data ?? []
  const items = itemsQuery.data ?? []
  const normalizedItemSearch = itemSearch.trim().toLowerCase()
  const normalizedCategorySearch = categorySearch.trim().toLowerCase()
  const filteredItems = items.filter((item) => {
    const matchesSearch = !normalizedItemSearch || item.code.toLowerCase().includes(normalizedItemSearch) || item.name.toLowerCase().includes(normalizedItemSearch)
    return matchesSearch && (itemCategory === 'all' || item.category_id === itemCategory) && matchesStatus(item.active, itemStatus)
  })
  const filteredCategories = categories.filter((category) => {
    return (!normalizedCategorySearch || category.name.toLowerCase().includes(normalizedCategorySearch)) && matchesStatus(category.active, categoryStatus)
  })

  function openNewItem() {
    setEditingItem(null)
    setItemDrawerOpen(true)
  }

  function openNewCategory() {
    setEditingCategory(null)
    setCategoryDrawerOpen(true)
  }

  async function saveItem(input: CatalogItemInput) {
    if (!online) {
      const error = new Error('Sem conexao. Reconecte para salvar o item.')
      toast.error(error.message)
      throw error
    }
    try {
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, input })
        toast.success('Item atualizado.')
      } else {
        await createItem.mutateAsync(input)
        toast.success('Item cadastrado no catalogo.')
      }
      setItemDrawerOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o item.')
      throw error
    }
  }

  async function saveCategory(input: CatalogCategoryInput) {
    if (!online) {
      const error = new Error('Sem conexao. Reconecte para salvar a categoria.')
      toast.error(error.message)
      throw error
    }
    try {
      if (editingCategory) {
        if (editingCategory.active && !input.active && !window.confirm(`Inativar a categoria "${editingCategory.name}"? Os itens historicos continuarao visiveis.`)) return
        await updateCategory.mutateAsync({ id: editingCategory.id, input })
        toast.success('Categoria atualizada.')
      } else {
        await createCategory.mutateAsync(input)
        toast.success('Categoria criada.')
      }
      setCategoryDrawerOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar a categoria.')
      throw error
    }
  }

  async function changeItemStatus(item: CatalogItemRow) {
    if (!online) {
      toast.error('Sem conexao. Reconecte para alterar o item.')
      return
    }
    if (item.active && !window.confirm(`Inativar o item "${item.name}"? O historico sera preservado.`)) return
    try {
      await setItemStatusMutation.mutateAsync({ id: item.id, active: !item.active })
      toast.success(item.active ? 'Item inativado.' : 'Item reativado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel alterar o item.')
    }
  }

  async function changeCategoryStatus(category: CatalogCategoryRow) {
    if (!online) {
      toast.error('Sem conexao. Reconecte para alterar a categoria.')
      return
    }
    if (category.active && !window.confirm(`Inativar a categoria "${category.name}"? Os itens historicos continuarao visiveis.`)) return
    try {
      await setCategoryStatusMutation.mutateAsync({ id: category.id, active: !category.active })
      toast.success(category.active ? 'Categoria inativada.' : 'Categoria reativada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel alterar a categoria.')
    }
  }

  const activeQuery = area === 'items' ? itemsQuery : categoriesQuery
  const isFirstLoad = activeQuery.isPending || (area === 'items' && categoriesQuery.isPending)

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        eyebrow="Motor de Precos"
        title="Catalogo Efetiva"
        description="Mantenha a referencia canonica de itens e servicos usada nas comparacoes."
        actions={(
          <>
            <Button variant="outline" disabled={!online} onClick={openNewCategory}><FolderPlus className="size-4" /> Nova categoria</Button>
            <Button disabled={!online} onClick={openNewItem}><Plus className="size-4" /> Novo item</Button>
          </>
        )}
      />

      <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Areas do catalogo">
        <button type="button" aria-pressed={area === 'items'} className={`rounded-lg px-5 py-2 text-sm font-bold transition-colors ${area === 'items' ? 'bg-emerald-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setArea('items')}>Itens</button>
        <button type="button" aria-pressed={area === 'categories'} className={`rounded-lg px-5 py-2 text-sm font-bold transition-colors ${area === 'categories' ? 'bg-emerald-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setArea('categories')}>Categorias</button>
      </div>

      {area === 'items' ? (
        <section aria-label="Itens do catalogo">
          <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(240px,1fr)_220px_180px]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" /><Input className="pl-9" aria-label="Buscar itens" placeholder="Buscar por codigo ou nome..." value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} /></div>
            <select className={`${selectClassName} w-full`} aria-label="Filtrar itens por categoria" value={itemCategory} onChange={(event) => setItemCategory(event.target.value)}>
              <option value="all">Todas as categorias</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.active ? '' : ' (inativa)'}</option>)}
            </select>
            <select className={`${selectClassName} w-full`} aria-label="Filtrar itens por status" value={itemStatus} onChange={(event) => setItemStatus(event.target.value as StatusFilter)}>
              <option value="all">Todos os status</option><option value="active">Ativos</option><option value="inactive">Inativos</option>
            </select>
          </div>
          {isFirstLoad ? <TableSkeleton columns={6} /> : activeQuery.isError || categoriesQuery.isError ? <ErrorState onRetry={() => { void itemsQuery.refetch(); void categoriesQuery.refetch() }} /> : items.length === 0 ? (
            <EmptyState title="Seu catalogo ainda esta vazio" description="Cadastre os itens e servicos que a Efetiva comercializa." action={<Button onClick={openNewItem}><Plus className="size-4" /> Cadastrar primeiro item</Button>} />
          ) : filteredItems.length === 0 ? (
            <EmptyState title="Nenhum item encontrado" description="Ajuste a busca ou os filtros para ver outros itens." action={<Button variant="outline" onClick={() => { setItemSearch(''); setItemCategory('all'); setItemStatus('all') }}>Limpar filtros</Button>} />
          ) : <CatalogItemsTable items={filteredItems} statusPending={setItemStatusMutation.isPending} onEdit={(item) => { setEditingItem(item); setItemDrawerOpen(true) }} onStatus={(item) => { void changeItemStatus(item) }} />}
        </section>
      ) : (
        <section aria-label="Categorias do catalogo">
          <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(240px,1fr)_180px]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" /><Input className="pl-9" aria-label="Buscar categorias" placeholder="Buscar categoria..." value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} /></div>
            <select className={`${selectClassName} w-full`} aria-label="Filtrar categorias por status" value={categoryStatus} onChange={(event) => setCategoryStatus(event.target.value as StatusFilter)}>
              <option value="all">Todos os status</option><option value="active">Ativas</option><option value="inactive">Inativas</option>
            </select>
          </div>
          {isFirstLoad ? <TableSkeleton columns={3} /> : activeQuery.isError ? <ErrorState onRetry={() => { void categoriesQuery.refetch() }} /> : categories.length === 0 ? (
            <EmptyState title="Nenhuma categoria cadastrada" description="Crie uma categoria antes de organizar os itens do catalogo." action={<Button onClick={openNewCategory}><FolderPlus className="size-4" /> Nova categoria</Button>} />
          ) : filteredCategories.length === 0 ? (
            <EmptyState title="Nenhuma categoria encontrada" description="Ajuste a busca ou o filtro para ver outras categorias." action={<Button variant="outline" onClick={() => { setCategorySearch(''); setCategoryStatus('all') }}>Limpar filtros</Button>} />
          ) : <CatalogCategoriesTable categories={filteredCategories} statusPending={setCategoryStatusMutation.isPending} onEdit={(category) => { setEditingCategory(category); setCategoryDrawerOpen(true) }} onStatus={(category) => { void changeCategoryStatus(category) }} />}
        </section>
      )}

      <Drawer open={itemDrawerOpen} onOpenChange={setItemDrawerOpen} title={editingItem ? 'Editar item' : 'Novo item'} description="Codigo, categoria e unidade formam a referencia canonica do catalogo.">
        {categories.every((category) => !category.active) && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Crie ou reative uma categoria para salvar um item.</div>}
        <CatalogItemForm
          key={editingItem?.id ?? 'new-item'}
          categories={categories}
          defaultValues={editingItem ? { code: editingItem.code, name: editingItem.name, category_id: editingItem.category_id, unit: editingItem.unit, description: editingItem.description ?? '' } : undefined}
          submitLabel={editingItem ? 'Salvar alteracoes' : 'Criar item'}
          onSubmit={saveItem}
          onCancel={() => setItemDrawerOpen(false)}
        />
      </Drawer>

      <Drawer open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen} title={editingCategory ? 'Editar categoria' : 'Nova categoria'} description="Categorias organizam os itens sem remover referencias historicas.">
        <CatalogCategoryForm
          key={editingCategory?.id ?? 'new-category'}
          defaultValues={editingCategory ? { name: editingCategory.name, active: editingCategory.active } : undefined}
          submitLabel={editingCategory ? 'Salvar alteracoes' : 'Criar categoria'}
          onSubmit={saveCategory}
          onCancel={() => setCategoryDrawerOpen(false)}
        />
      </Drawer>
    </div>
  )
}
