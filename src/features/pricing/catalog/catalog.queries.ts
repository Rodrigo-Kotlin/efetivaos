import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCatalogCategory,
  createCatalogItem,
  listCatalogCategories,
  listCatalogItems,
  setCatalogCategoryStatus,
  setCatalogItemStatus,
  updateCatalogCategory,
  updateCatalogItem,
} from './catalog.service'
import type { CatalogCategoryInput, CatalogItemInput } from './catalog.types'

export const catalogKeys = {
  all: ['catalog'] as const,
  items: () => [...catalogKeys.all, 'items'] as const,
  categories: () => [...catalogKeys.all, 'categories'] as const,
}

export function useCatalogItems() {
  return useQuery({ queryKey: catalogKeys.items(), queryFn: listCatalogItems })
}

export function useCatalogCategories() {
  return useQuery({ queryKey: catalogKeys.categories(), queryFn: listCatalogCategories })
}

export function useCreateCatalogItem() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createCatalogItem, onSuccess: () => client.invalidateQueries({ queryKey: catalogKeys.items() }) })
}

export function useUpdateCatalogItem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CatalogItemInput }) => updateCatalogItem(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: catalogKeys.items() }),
  })
}

export function useSetCatalogItemStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setCatalogItemStatus(id, active),
    onSuccess: () => client.invalidateQueries({ queryKey: catalogKeys.items() }),
  })
}

function useInvalidateCategories() {
  const client = useQueryClient()
  return () => Promise.all([
    client.invalidateQueries({ queryKey: catalogKeys.categories() }),
    client.invalidateQueries({ queryKey: catalogKeys.items() }),
  ])
}

export function useCreateCatalogCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({ mutationFn: createCatalogCategory, onSuccess: invalidate })
}

export function useUpdateCatalogCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CatalogCategoryInput }) => updateCatalogCategory(id, input),
    onSuccess: invalidate,
  })
}

export function useSetCatalogCategoryStatus() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setCatalogCategoryStatus(id, active),
    onSuccess: invalidate,
  })
}
