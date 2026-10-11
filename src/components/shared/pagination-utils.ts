export function pageItems(page: number, pageCount: number) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis-right', pageCount] as const
  if (page >= pageCount - 3) return [1, 'ellipsis-left', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount] as const
  return [1, 'ellipsis-left', page - 1, page, page + 1, 'ellipsis-right', pageCount] as const
}
