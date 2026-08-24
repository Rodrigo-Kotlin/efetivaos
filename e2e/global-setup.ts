import { cleanupFixtures, createFixtureState, saveFixtureState, serviceClient } from './fixtures'
import { assertRemoteMutationAllowed, loadE2EEnv, requiredEnv } from './env'

export default async function globalSetup() {
  loadE2EEnv()
  requiredEnv('VITE_SUPABASE_ANON_KEY')
  requiredEnv('SPRINT0_ADMIN_EMAIL')
  requiredEnv('SPRINT0_ADMIN_PASSWORD')
  assertRemoteMutationAllowed()

  const client = serviceClient()
  const state = createFixtureState()
  await saveFixtureState(state)

  try {
    const { data: supplier, error: supplierError } = await client
      .from('suppliers')
      .insert({ name: state.supplierName, active: true, notes: state.prefix })
      .select('id')
      .single()
    if (supplierError) throw new Error(`Failed to provision E2E supplier: ${supplierError.message}`)
    state.supplierId = supplier.id
    await saveFixtureState(state)

    const { data: category, error: categoryError } = await client
      .from('catalog_categories')
      .insert({ name: state.categoryName, active: true })
      .select('id')
      .single()
    if (categoryError) throw new Error(`Failed to provision E2E category: ${categoryError.message}`)
    state.categoryId = category.id
    await saveFixtureState(state)

    const { data: item, error: itemError } = await client
      .from('catalog_items')
      .insert({
        code: state.catalogItemCode,
        name: state.catalogItemName,
        category_id: state.categoryId,
        unit: 'unidade',
        active: true,
        description: state.prefix,
      })
      .select('id')
      .single()
    if (itemError) throw new Error(`Failed to provision E2E catalog item: ${itemError.message}`)
    state.catalogItemId = item.id
    await saveFixtureState(state)
  } catch (setupError) {
    try {
      await cleanupFixtures(client, state)
    } catch (cleanupError) {
      throw new AggregateError([setupError, cleanupError], 'E2E fixture setup and rollback both failed')
    }
    throw setupError
  }
}
