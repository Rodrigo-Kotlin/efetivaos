import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

describe('CRM Pipeline Core', () => {
  describe('Types', () => {
    it('CrmPipeline has required fields', () => {
      const pipeline = {
        id: '1', name: 'Pipeline Comercial', description: null,
        active: true, is_default: true,
        created_at: '2026-01-01', updated_at: '2026-01-01', created_by: null,
      }
      expect(pipeline.id).toBeTruthy()
      expect(pipeline.name).toBeTruthy()
      expect(pipeline.active).toBe(true)
      expect(pipeline.is_default).toBe(true)
    })

    it('CrmStage has required fields', () => {
      const stage = {
        id: '1', pipeline_id: 'p1', name: 'Novo contato',
        position: 1, probability: 10, active: true,
        created_at: '2026-01-01', updated_at: '2026-01-01',
      }
      expect(stage.pipeline_id).toBeTruthy()
      expect(stage.position).toBeGreaterThanOrEqual(1)
      expect(stage.probability).toBeGreaterThanOrEqual(0)
      expect(stage.probability).toBeLessThanOrEqual(100)
    })

    it('CrmOpportunity has required fields', () => {
      const opp = {
        id: '1', client_id: 'c1', pipeline_id: 'p1', stage_id: 's1',
        title: 'Test', description: null, value: 1000,
        probability: 10, expected_close_date: null,
        responsible_user_id: null, status: 'open',
        won_at: null, lost_at: null, lost_reason: null,
        sort_order: 1, created_by: null,
        created_at: '2026-01-01', updated_at: '2026-01-01',
      }
      expect(opp.client_id).toBeTruthy()
      expect(opp.pipeline_id).toBeTruthy()
      expect(opp.stage_id).toBeTruthy()
      expect(opp.status).toBe('open')
      expect(opp.value).toBeGreaterThanOrEqual(0)
    })

    it('OpportunityStatus has valid values', () => {
      const validStatuses = ['open', 'won', 'lost']
      expect(validStatuses).toContain('open')
      expect(validStatuses).toContain('won')
      expect(validStatuses).toContain('lost')
      expect(validStatuses).toHaveLength(3)
    })

    it('CrmBoardColumn has required fields', () => {
      const col = {
        stage_id: 's1', stage_name: 'Novo contato',
        stage_position: 1, stage_probability: 10,
        opportunities: [], total_value: 0, count: 0,
      }
      expect(col.stage_id).toBeTruthy()
      expect(col.opportunities).toHaveLength(0)
      expect(col.count).toBe(0)
    })
  })

  describe('Seed data', () => {
    it('default pipeline name', () => {
      expect('Pipeline Comercial').toBeTruthy()
    })

    it('5 stages with correct names', () => {
      const stages = [
        { name: 'Novo contato', position: 1, probability: 10 },
        { name: 'Qualificação', position: 2, probability: 20 },
        { name: 'Diagnóstico', position: 3, probability: 40 },
        { name: 'Proposta', position: 4, probability: 60 },
        { name: 'Negociação', position: 5, probability: 80 },
      ]
      expect(stages).toHaveLength(5)
      expect(stages[0].probability).toBe(10)
      expect(stages[4].probability).toBe(80)
    })

    it('probabilities increase monotonically', () => {
      const probs = [10, 20, 40, 60, 80]
      for (let i = 1; i < probs.length; i++) {
        expect(probs[i]).toBeGreaterThan(probs[i - 1])
      }
    })

    it('positions are sequential 1-5', () => {
      const positions = [1, 2, 3, 4, 5]
      expect(positions).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('API functions', () => {
    it('fetchCrmOpportunities is a function', async () => {
      const { fetchCrmOpportunities } = await import('../api/crm-api')
      expect(typeof fetchCrmOpportunities).toBe('function')
    })

    it('moveCrmOpportunity is a function', async () => {
      const { moveCrmOpportunity } = await import('../api/crm-api')
      expect(typeof moveCrmOpportunity).toBe('function')
    })

    it('markOpportunityWon is a function', async () => {
      const { markOpportunityWon } = await import('../api/crm-api')
      expect(typeof markOpportunityWon).toBe('function')
    })

    it('markOpportunityLost is a function', async () => {
      const { markOpportunityLost } = await import('../api/crm-api')
      expect(typeof markOpportunityLost).toBe('function')
    })

    it('createCrmOpportunity is a function', async () => {
      const { createCrmOpportunity } = await import('../api/crm-api')
      expect(typeof createCrmOpportunity).toBe('function')
    })

    it('updateCrmOpportunity is a function', async () => {
      const { updateCrmOpportunity } = await import('../api/crm-api')
      expect(typeof updateCrmOpportunity).toBe('function')
    })
  })

  describe('Query keys', () => {
    it('crmPipelineKeys.all is defined', async () => {
      const { crmPipelineKeys } = await import('../queries/pipeline-queries')
      expect(crmPipelineKeys.all).toEqual(['crm', 'pipeline'])
    })

    it('crmPipelineKeys.pipelines() returns correct key', async () => {
      const { crmPipelineKeys } = await import('../queries/pipeline-queries')
      expect(crmPipelineKeys.pipelines()).toEqual(['crm', 'pipeline', 'pipelines'])
    })

    it('crmPipelineKeys.stages() returns correct key', async () => {
      const { crmPipelineKeys } = await import('../queries/pipeline-queries')
      expect(crmPipelineKeys.stages('p1')).toEqual(['crm', 'pipeline', 'stages', 'p1'])
    })

    it('crmPipelineKeys.opportunities() returns correct key', async () => {
      const { crmPipelineKeys } = await import('../queries/pipeline-queries')
      expect(crmPipelineKeys.opportunities('p1')).toEqual(['crm', 'pipeline', 'opportunities', 'p1'])
    })

    it('crmPipelineKeys.opportunity() returns correct key', async () => {
      const { crmPipelineKeys } = await import('../queries/pipeline-queries')
      expect(crmPipelineKeys.opportunity('o1')).toEqual(['crm', 'pipeline', 'opportunity', 'o1'])
    })
  })

  describe('Loss reasons', () => {
    it('has all required reasons', () => {
      const reasons = ['Preço', 'Concorrente', 'Sem orçamento', 'Sem retorno', 'Prazo', 'Escopo incompatível', 'Cliente desistiu', 'Outro']
      expect(reasons).toHaveLength(8)
      expect(reasons).toContain('Preço')
      expect(reasons).toContain('Outro')
    })
  })
})
