import { rm } from 'node:fs/promises'

import { cleanupFixtures, fixtureStatePath, readFixtureState, serviceClient } from './fixtures'
import { loadE2EEnv } from './env'

export default async function globalTeardown() {
  loadE2EEnv()
  let state
  try {
    state = await readFixtureState()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }

  try {
    await cleanupFixtures(serviceClient(), state)
  } catch (error) {
    console.warn('[globalTeardown] Fixture cleanup failed (non-fatal):', error instanceof Error ? error.message : error)
  }
  await rm(fixtureStatePath, { force: true })
}
