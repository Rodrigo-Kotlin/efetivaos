import { cleanupFixtures, createFixtureState, saveFixtureState, serviceClient } from './fixtures'
import { assertRemoteMutationAllowed, loadE2EEnv, requiredEnv } from './env'

export default async function globalSetup() {
  loadE2EEnv()
  requiredEnv('VITE_SUPABASE_ANON_KEY')
  requiredEnv('SPRINT0_ADMIN_EMAIL')
  requiredEnv('SPRINT0_ADMIN_PASSWORD')
  requiredEnv('SPRINT0_EQUIPE_EMAIL')
  requiredEnv('SPRINT0_EQUIPE_PASSWORD')
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

    const { data: priceCategory, error: priceCategoryError } = await client
      .from('catalog_categories')
      .insert({ name: state.priceApproval.categoryName, active: true })
      .select('id')
      .single()
    if (priceCategoryError) throw new Error(`Failed to provision price-approval category: ${priceCategoryError.message}`)
    state.priceApproval.categoryId = priceCategory.id
    await saveFixtureState(state)

    const { data: priceItem, error: priceItemError } = await client
      .from('catalog_items')
      .insert({
        code: state.priceApproval.catalogItemCode,
        name: state.priceApproval.catalogItemName,
        category_id: priceCategory.id,
        unit: 'unidade',
        active: true,
        description: state.prefix,
      })
      .select('id')
      .single()
    if (priceItemError) throw new Error(`Failed to provision price-approval catalog item: ${priceItemError.message}`)
    state.priceApproval.catalogItemId = priceItem.id
    await saveFixtureState(state)

    const { data: priceSuppliers, error: priceSuppliersError } = await client
      .from('suppliers')
      .insert([
        { name: state.priceApproval.bestSupplierName, active: true, notes: state.prefix },
        { name: state.priceApproval.alternativeSupplierName, active: true, notes: state.prefix },
      ])
      .select('id, name')
    if (priceSuppliersError) throw new Error(`Failed to provision price-approval suppliers: ${priceSuppliersError.message}`)
    state.priceApproval.bestSupplierId = priceSuppliers.find((supplier) => supplier.name === state.priceApproval.bestSupplierName)?.id
    state.priceApproval.alternativeSupplierId = priceSuppliers.find((supplier) => supplier.name === state.priceApproval.alternativeSupplierName)?.id
    if (!state.priceApproval.bestSupplierId || !state.priceApproval.alternativeSupplierId) throw new Error('Price-approval supplier IDs were not returned')
    await saveFixtureState(state)

    const quotationFixtures = [
      {
        supplierId: state.priceApproval.bestSupplierId,
        reference: state.priceApproval.bestQuotationReference,
        unitPrice: '80.00',
        kind: 'best' as const,
      },
      {
        supplierId: state.priceApproval.alternativeSupplierId,
        reference: state.priceApproval.alternativeQuotationReference,
        unitPrice: '100.00',
        kind: 'alternative' as const,
      },
    ]

    for (const quotationFixture of quotationFixtures) {
      const { data: quotation, error: quotationError } = await client
        .from('quotations')
        .insert({
          supplier_id: quotationFixture.supplierId,
          reference_number: quotationFixture.reference,
          received_at: '2026-08-24',
          valid_until: '2027-08-24',
          status: 'draft',
          notes: state.prefix,
        })
        .select('id')
        .single()
      if (quotationError) throw new Error(`Failed to provision ${quotationFixture.kind} price-approval quotation: ${quotationError.message}`)

      const { data: quotationItem, error: quotationItemError } = await client
        .from('quotation_items')
        .insert({
          quotation_id: quotation.id,
          catalog_item_id: priceItem.id,
          supplier_description: `${state.prefix}_${quotationFixture.kind.toUpperCase()}_OFFER`,
          unit_price: quotationFixture.unitPrice,
          notes: state.prefix,
        })
        .select('id')
        .single()
      if (quotationItemError) throw new Error(`Failed to provision ${quotationFixture.kind} price-approval quotation item: ${quotationItemError.message}`)

      const { error: activationError } = await client.from('quotations').update({ status: 'active' }).eq('id', quotation.id)
      if (activationError) throw new Error(`Failed to activate ${quotationFixture.kind} price-approval quotation: ${activationError.message}`)

      if (quotationFixture.kind === 'best') {
        state.priceApproval.bestQuotationId = quotation.id
        state.priceApproval.bestQuotationItemId = quotationItem.id
      } else {
        state.priceApproval.alternativeQuotationId = quotation.id
        state.priceApproval.alternativeQuotationItemId = quotationItem.id
      }
      await saveFixtureState(state)
    }

    const { data: marginRule, error: marginRuleError } = await client
      .from('margin_rules')
      .insert({
        scope_type: 'item',
        category_id: null,
        catalog_item_id: priceItem.id,
        calculation_type: 'percentage',
        value: '25.0000',
        active: true,
        notes: `${state.prefix}_PRICE_RULE_ITEM`,
      })
      .select('id')
      .single()
    if (marginRuleError) throw new Error(`Failed to provision price-approval rule: ${marginRuleError.message}`)
    state.priceApproval.marginRuleId = marginRule.id
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
