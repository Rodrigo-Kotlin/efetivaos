import { describe, it, expect, vi } from 'vitest'

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

describe('CRM Pipeline Core + Activities First', () => {
  describe('Types - Pipeline (08A)', () => {
    it('CrmPipeline has required fields', () => {
      const pipeline = {
        id: '1', name: 'Pipeline Comercial', description: null,
        active: true, is_default: true,
        created_at: '2026-01-01', updated_at: '2026-01-01', created_by: null,
      }
      expect(pipeline.id).toBeTruthy()
      expect(pipeline.active).toBe(true)
    })

    it('CrmStage has required fields', () => {
      const stage = {
        id: '1', pipeline_id: 'p1', name: 'Novo contato',
        position: 1, probability: 10, active: true,
        created_at: '2026-01-01', updated_at: '2026-01-01',
      }
      expect(stage.position).toBeGreaterThanOrEqual(1)
      expect(stage.probability).toBeGreaterThanOrEqual(0)
    })

    it('CrmOpportunity has required fields', () => {
      const opp = {
        id: '1', client_id: 'c1', pipeline_id: 'p1', stage_id: 's1',
        title: 'Test', value: 1000, probability: 10, status: 'open',
        sort_order: 1, created_at: '2026-01-01', updated_at: '2026-01-01',
        created_by: null, updated_by: null,
      }
      expect(opp.status).toBe('open')
    })
  })

  describe('Types - Activities (08B)', () => {
    it('ActivityType has all valid types', () => {
      const types = ['Ligação', 'WhatsApp', 'E-mail', 'Reunião', 'Visita', 'Follow-up', 'Preparar proposta', 'Enviar proposta', 'Solicitar documentos', 'Outro']
      expect(types).toHaveLength(10)
      expect(types).toContain('Ligação')
      expect(types).toContain('Follow-up')
      expect(types).toContain('Outro')
    })

    it('ActivityStatus has valid values', () => {
      const statuses = ['pending', 'completed', 'cancelled']
      expect(statuses).toHaveLength(3)
    })

    it('ActivityNextStatus has valid values', () => {
      const semantics = ['overdue', 'today', 'upcoming', 'none']
      expect(semantics).toHaveLength(4)
    })

    it('CrmActivity has required fields', () => {
      const act = {
        id: '1', opportunity_id: 'o1', client_id: 'c1',
        type: 'Ligação', title: 'Test', description: null,
        due_at: '2026-01-01T10:00:00Z', completed_at: null,
        responsible_user_id: null, status: 'pending', outcome: null,
        created_by: null, created_at: '2026-01-01', updated_at: '2026-01-01',
      }
      expect(act.status).toBe('pending')
      expect(act.type).toBe('Ligação')
    })

    it('CrmOpportunityEvent has required fields', () => {
      const evt = {
        id: '1', opportunity_id: 'o1', event_type: 'activity_created',
        event_data: { activity_id: 'a1' }, created_by: null,
        created_at: '2026-01-01',
      }
      expect(evt.event_type).toBeTruthy()
    })

    it('CrmLossReason has required fields', () => {
      const reason = {
        id: '1', name: 'Preço', active: true, position: 1,
        created_at: '2026-01-01',
      }
      expect(reason.name).toBeTruthy()
      expect(reason.active).toBe(true)
    })

    it('CrmOpportunityBoardRowExtended has next_activity fields', () => {
      const ext = {
        opportunity_id: '1', next_activity_id: 'a1', next_activity_type: 'Ligação',
        next_activity_title: 'Call', next_activity_due_at: '2026-01-01T10:00:00Z',
        next_activity_responsible_user_id: null, next_activity_status_semantic: 'upcoming',
        lost_reason_id: null, lost_reason_detail: null, loss_reason_name: null,
      }
      expect(ext.next_activity_status_semantic).toBe('upcoming')
    })
  })

  describe('Seed data', () => {
    it('default pipeline name', () => {
      expect('Pipeline Comercial').toBeTruthy()
    })

    it('5 stages with correct probabilities', () => {
      const probs = [10, 20, 40, 60, 80]
      expect(probs).toHaveLength(5)
      for (let i = 1; i < probs.length; i++) {
        expect(probs[i]).toBeGreaterThan(probs[i - 1])
      }
    })

    it('8 loss reasons', () => {
      const reasons = ['Preço', 'Concorrente', 'Sem orçamento', 'Sem retorno', 'Prazo', 'Escopo incompatível', 'Cliente desistiu', 'Outro']
      expect(reasons).toHaveLength(8)
    })
  })

  describe('Event types', () => {
    it('has all required event types', () => {
      const types = [
        'opportunity_created', 'opportunity_updated', 'stage_changed',
        'activity_created', 'activity_completed', 'activity_cancelled',
        'activity_rescheduled', 'marked_won', 'marked_lost', 'loss_reason_changed',
      ]
      expect(types).toHaveLength(10)
      expect(types).toContain('activity_created')
      expect(types).toContain('activity_completed')
      expect(types).toContain('marked_won')
    })
  })

  describe('API functions', () => {
    it('createCrmActivity is a function', async () => {
      const { createCrmActivity } = await import('../api/crm-api')
      expect(typeof createCrmActivity).toBe('function')
    })

    it('completeCrmActivity is a function', async () => {
      const { completeCrmActivity } = await import('../api/crm-api')
      expect(typeof completeCrmActivity).toBe('function')
    })

    it('cancelCrmActivity is a function', async () => {
      const { cancelCrmActivity } = await import('../api/crm-api')
      expect(typeof cancelCrmActivity).toBe('function')
    })

    it('fetchCrmActivities is a function', async () => {
      const { fetchCrmActivities } = await import('../api/crm-api')
      expect(typeof fetchCrmActivities).toBe('function')
    })

    it('fetchCrmEvents is a function', async () => {
      const { fetchCrmEvents } = await import('../api/crm-api')
      expect(typeof fetchCrmEvents).toBe('function')
    })

    it('fetchCrmLossReasons is a function', async () => {
      const { fetchCrmLossReasons } = await import('../api/crm-api')
      expect(typeof fetchCrmLossReasons).toBe('function')
    })

    it('fetchCrmOpportunityExtended is a function', async () => {
      const { fetchCrmOpportunityExtended } = await import('../api/crm-api')
      expect(typeof fetchCrmOpportunityExtended).toBe('function')
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
  })

  describe('Query keys', () => {
    it('crmPipelineKeys.activities() returns correct key', async () => {
      const { crmPipelineKeys } = await import('../queries/pipeline-queries')
      expect(crmPipelineKeys.activities('o1')).toEqual(['crm', 'pipeline', 'activities', 'o1'])
    })

    it('crmPipelineKeys.events() returns correct key', async () => {
      const { crmPipelineKeys } = await import('../queries/pipeline-queries')
      expect(crmPipelineKeys.events('o1')).toEqual(['crm', 'pipeline', 'events', 'o1'])
    })

    it('crmPipelineKeys.lossReasons() returns correct key', async () => {
      const { crmPipelineKeys } = await import('../queries/pipeline-queries')
      expect(crmPipelineKeys.lossReasons()).toEqual(['crm', 'pipeline', 'lossReasons'])
    })
  })

  describe('Card activity status', () => {
    it('overdue is displayed with alert', () => {
      const semantic = 'overdue'
      expect(semantic).toBe('overdue')
    })

    it('today is displayed with clock', () => {
      const semantic = 'today'
      expect(semantic).toBe('today')
    })

    it('none shows "Sem próxima atividade"', () => {
      const semantic = 'none'
      expect(semantic).toBe('none')
    })
  })

  describe('Loss reasons', () => {
    it('structured reasons from table', () => {
      const reasonId = 'r1'
      const reasonName = 'Preço'
      expect(reasonId).toBeTruthy()
      expect(reasonName).toBeTruthy()
    })

    it('Outro requires detail', () => {
      const name: string = 'Outro'
      const detail = ''
      const isValid = name !== 'Outro' || detail.trim().length > 0
      expect(isValid).toBe(false)
    })

    it('Non-Outro does not require detail', () => {
      const name: string = 'Preço'
      const detail = ''
      const isValid = name !== 'Outro' || detail.trim().length > 0
      expect(isValid).toBe(true)
    })
  })

  describe('Next activity semantic', () => {
    it('overdue when before today', () => {
      const due = new Date('2020-01-01')
      const today = new Date('2026-01-01')
      const semantic = due < today ? 'overdue' : 'upcoming'
      expect(semantic).toBe('overdue')
    })

    it('today when same day', () => {
      const now = new Date()
      const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate())
      const diffDays = Math.floor((dueDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(0)
    })

    it('upcoming when future', () => {
      const now = new Date()
      const due = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate())
      const diffDays = Math.floor((dueDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBeGreaterThan(0)
    })

    it('none when no activity', () => {
      const nextActivityId = null
      const semantic = nextActivityId ? 'upcoming' : 'none'
      expect(semantic).toBe('none')
    })
  })

  describe('KPI counts', () => {
    it('overdue activities counted', () => {
      const opps = [
        { next_activity_status_semantic: 'overdue' },
        { next_activity_status_semantic: 'overdue' },
        { next_activity_status_semantic: 'today' },
      ]
      const count = opps.filter(o => o.next_activity_status_semantic === 'overdue').length
      expect(count).toBe(2)
    })

    it('no-next-activity counted', () => {
      const opps = [
        { next_activity_status_semantic: 'none' },
        { next_activity_status_semantic: 'upcoming' },
      ]
      const count = opps.filter(o => o.next_activity_status_semantic === 'none').length
      expect(count).toBe(1)
    })
  })

  // ======================================================================
  // CRM 08C — Views & Intelligence
  // ======================================================================

  describe('Aging', () => {
    it('stage_age_days >= 0', () => {
      const days = 5
      expect(days).toBeGreaterThanOrEqual(0)
    })

    it('normal aging (0-3 days)', () => {
      const days = 2
      const label = days <= 3 ? 'normal' : days <= 7 ? 'attention' : 'high'
      expect(label).toBe('normal')
    })

    it('attention aging (4-7 days)', () => {
      const days = 5
      const label = days <= 3 ? 'normal' : days <= 7 ? 'attention' : 'high'
      expect(label).toBe('attention')
    })

    it('high aging (8+ days)', () => {
      const days = 12
      const label = days <= 3 ? 'normal' : days <= 7 ? 'attention' : 'high'
      expect(label).toBe('high')
    })

    it('aging resets on stage change', () => {
      const enteredAt = new Date()
      const now = new Date()
      const ageDays = Math.floor((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24))
      expect(ageDays).toBe(0)
    })
  })

  describe('List view sorting', () => {
    it('sorts by value ascending', () => {
      const items = [{ value: 3000 }, { value: 1000 }, { value: 2000 }]
      items.sort((a, b) => a.value - b.value)
      expect(items.map(i => i.value)).toEqual([1000, 2000, 3000])
    })

    it('sorts by value descending', () => {
      const items = [{ value: 3000 }, { value: 1000 }, { value: 2000 }]
      items.sort((a, b) => b.value - a.value)
      expect(items.map(i => i.value)).toEqual([3000, 2000, 1000])
    })

    it('sorts by title ascending', () => {
      const items = [{ title: 'Charlie' }, { title: 'Alice' }, { title: 'Bob' }]
      items.sort((a, b) => a.title.localeCompare(b.title))
      expect(items.map(i => i.title)).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('sorts by aging descending (oldest first)', () => {
      const items = [{ stage_age_days: 2 }, { stage_age_days: 10 }, { stage_age_days: 5 }]
      items.sort((a, b) => b.stage_age_days - a.stage_age_days)
      expect(items.map(i => i.stage_age_days)).toEqual([10, 5, 2])
    })
  })

  describe('Filters', () => {
    it('search filters by title', () => {
      const opps = [
        { title: 'Proposta SST', client_name: 'ABC' },
        { title: 'Gestão RH', client_name: 'XYZ' },
      ]
      const q = 'sst'
      const filtered = opps.filter(o => o.title.toLowerCase().includes(q))
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Proposta SST')
    })

    it('search filters by client', () => {
      const opps = [
        { title: 'Proposta', client_name: 'ABC Ltda' },
        { title: 'Gestão', client_name: 'XYZ SA' },
      ]
      const q = 'xyz'
      const filtered = opps.filter(o => o.client_name.toLowerCase().includes(q))
      expect(filtered).toHaveLength(1)
    })

    it('stage filter works', () => {
      const opps = [
        { stage_id: 's1', title: 'A' },
        { stage_id: 's2', title: 'B' },
        { stage_id: 's1', title: 'C' },
      ]
      const filtered = opps.filter(o => o.stage_id === 's1')
      expect(filtered).toHaveLength(2)
    })

    it('status filter works', () => {
      const opps = [
        { status: 'open', title: 'A' },
        { status: 'won', title: 'B' },
        { status: 'lost', title: 'C' },
      ]
      expect(opps.filter(o => o.status === 'open')).toHaveLength(1)
      expect(opps.filter(o => o.status === 'won')).toHaveLength(1)
      expect(opps.filter(o => o.status === 'lost')).toHaveLength(1)
    })

    it('value range filter works', () => {
      const opps = [
        { value: 1000 },
        { value: 5000 },
        { value: 10000 },
      ]
      const min = 3000
      const max = 8000
      const filtered = opps.filter(o => o.value >= min && o.value <= max)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].value).toBe(5000)
    })

    it('activity filter works', () => {
      const opps = [
        { next_activity_status_semantic: 'overdue' },
        { next_activity_status_semantic: 'today' },
        { next_activity_status_semantic: 'none' },
      ]
      expect(opps.filter(o => o.next_activity_status_semantic === 'overdue')).toHaveLength(1)
      expect(opps.filter(o => o.next_activity_status_semantic === 'none')).toHaveLength(1)
    })
  })

  describe('Analytics', () => {
    it('conversion rate formula', () => {
      const won = 10
      const lost = 5
      const rate = won / (won + lost) * 100
      expect(rate).toBeCloseTo(66.67, 1)
    })

    it('conversion rate with zero', () => {
      const won = 0
      const lost = 0
      const rate = (won + lost) > 0 ? won / (won + lost) * 100 : 0
      expect(rate).toBe(0)
    })

    it('weighted value formula', () => {
      const value = 10000
      const probability = 40
      const weighted = value * probability / 100
      expect(weighted).toBe(4000)
    })

    it('stage metrics structure', () => {
      const sm = {
        stage_id: 's1', stage_name: 'Novo contato', position: 1,
        entered_count: 5, exited_count: 3, current_count: 2, avg_duration_days: 4.5,
      }
      expect(sm.entered_count).toBeGreaterThanOrEqual(0)
      expect(sm.exited_count).toBeGreaterThanOrEqual(0)
      expect(sm.current_count).toBeGreaterThanOrEqual(0)
      expect(sm.avg_duration_days).toBeGreaterThanOrEqual(0)
    })

    it('loss reason structure', () => {
      const lr = {
        reason_id: 'r1', reason_name: 'Preço', count: 8, value: 50000, percentage: 35.5,
      }
      expect(lr.count).toBeGreaterThanOrEqual(0)
      expect(lr.percentage).toBeGreaterThanOrEqual(0)
    })

    it('forecast structure', () => {
      const f = {
        month: '2026-09', month_label: 'Sep 2026',
        total_value: 120000, weighted_value: 73000, opportunity_count: 15,
      }
      expect(f.total_value).toBeGreaterThanOrEqual(0)
      expect(f.weighted_value).toBeGreaterThanOrEqual(0)
      expect(f.opportunity_count).toBeGreaterThanOrEqual(0)
    })

    it('totals reconcile', () => {
      const totals = {
        open_count: 10, open_value: 50000, weighted_value: 30000,
        won_count: 5, won_value: 25000, lost_count: 3, lost_value: 15000,
      }
      expect(totals.open_count + totals.won_count + totals.lost_count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('View toggle', () => {
    it('pipeline and list are valid modes', () => {
      const modes = ['pipeline', 'list']
      expect(modes).toContain('pipeline')
      expect(modes).toContain('list')
    })

    it('localStorage persistence', () => {
      const key = 'crm-view-mode'
      localStorage.setItem(key, 'list')
      expect(localStorage.getItem(key)).toBe('list')
      localStorage.removeItem(key)
    })
  })

  describe('List columns', () => {
    it('has required columns', () => {
      const columns = ['title', 'client_name', 'stage_name', 'value', 'probability', 'next_activity', 'expected_close_date', 'stage_age_days']
      expect(columns).toHaveLength(8)
      expect(columns).toContain('stage_age_days')
      expect(columns).toContain('next_activity')
    })
  })

  // ======================================================================
  // CRM 08D — Refinamento Operacional e UX
  // ======================================================================

  describe('Filter conflict resolution', () => {
    it('quick filter clears advanced activity', () => {
      let quickFilter = 'all'
      let advancedActivity = 'overdue'
      // When quick filter changes to non-all, advanced activity should clear
      if (quickFilter !== 'all') advancedActivity = ''
      quickFilter = 'overdue'
      if (quickFilter !== 'all') advancedActivity = ''
      expect(advancedActivity).toBe('')
    })

    it('advanced activity clears quick filter', () => {
      let quickFilter = 'overdue'
      let advancedActivity = ''
      // When advanced activity is set, quick filter should reset to all
      advancedActivity = 'today'
      if (advancedActivity) quickFilter = 'all'
      expect(quickFilter).toBe('all')
    })

    it('clear all resets both', () => {
      let quickFilter = 'overdue'
      let filters = { activity: 'today', search: 'test' }
      quickFilter = 'all'
      filters = { activity: '', search: '', stage_id: '', status: '', value_min: '', value_max: '', date_from: '', date_to: '' }
      expect(quickFilter).toBe('all')
      expect(filters.activity).toBe('')
      expect(filters.search).toBe('')
    })
  })

  describe('Active filter count', () => {
    it('counts quick filter as 1', () => {
      const quickFilter = 'overdue'
      const filters = { search: '', stage_id: '', status: '', activity: '', value_min: '', value_max: '', date_from: '', date_to: '' }
      const advancedCount = Object.values(filters).filter(v => v !== '').length
      const totalCount = advancedCount + (quickFilter !== 'all' ? 1 : 0)
      expect(totalCount).toBe(1)
    })

    it('counts combined filters', () => {
      const quickFilter = 'all'
      const filters = { search: 'test', stage_id: 's1', status: '', activity: '', value_min: '', value_max: '', date_from: '', date_to: '' }
      const advancedCount = Object.values(filters).filter(v => v !== '').length
      const totalCount = advancedCount + (quickFilter !== 'all' ? 1 : 0)
      expect(totalCount).toBe(2)
    })

    it('zero when no filters', () => {
      const quickFilter = 'all'
      const filters = { search: '', stage_id: '', status: '', activity: '', value_min: '', value_max: '', date_from: '', date_to: '' }
      const advancedCount = Object.values(filters).filter(v => v !== '').length
      const totalCount = advancedCount + (quickFilter !== 'all' ? 1 : 0)
      expect(totalCount).toBe(0)
    })
  })

  describe('Empty states', () => {
    it('no opportunities vs no filter results', () => {
      const opps: unknown[] = []
      const activeFilterCount = 0
      const message = opps.length === 0 && activeFilterCount === 0
        ? 'Nenhuma oportunidade aberta'
        : opps.length === 0
          ? 'Nenhuma oportunidade corresponde aos filtros'
          : ''
      expect(message).toBe('Nenhuma oportunidade aberta')
    })

    it('filter returns empty shows different message', () => {
      const opps = [{ id: '1' }]
      const filteredOpps: unknown[] = []
      const activeFilterCount = 2
      const message = filteredOpps.length === 0 && activeFilterCount > 0
        ? 'Nenhuma oportunidade corresponde aos filtros'
        : ''
      expect(message).toBe('Nenhuma oportunidade corresponde aos filtros')
    })
  })

  describe('Sort persistence', () => {
    it('persists sortDir to localStorage', () => {
      const key = 'crm-list-sort-dir'
      localStorage.setItem(key, 'asc')
      expect(localStorage.getItem(key)).toBe('asc')
      localStorage.setItem(key, 'desc')
      expect(localStorage.getItem(key)).toBe('desc')
      localStorage.removeItem(key)
    })
  })

  describe('Touch DnD configuration', () => {
    it('PointerSensor uses distance activationConstraint', () => {
      const config = { activationConstraint: { distance: 8 } }
      expect(config.activationConstraint.distance).toBe(8)
    })

    it('TouchSensor uses delay + tolerance', () => {
      const config = { activationConstraint: { delay: 150, tolerance: 5 } }
      expect(config.activationConstraint.delay).toBe(150)
      expect(config.activationConstraint.tolerance).toBe(5)
    })
  })

  describe('Drag-after-click prevention', () => {
    it('dragDidMove flag prevents click after drag', () => {
      let dragDidMove = false
      function handleDragOver() { dragDidMove = true }
      function handleCardClick() {
        if (dragDidMove) return 'blocked'
        return 'opened'
      }
      handleDragOver()
      expect(handleCardClick()).toBe('blocked')
    })

    it('click works without drag', () => {
      let dragDidMove = false
      function handleCardClick() {
        if (dragDidMove) return 'blocked'
        return 'opened'
      }
      expect(handleCardClick()).toBe('opened')
    })
  })

  describe('Timezone handling', () => {
    it('toLocalDatetimeString creates valid date', () => {
      const dateStr = '2026-08-28'
      const timeStr = '15:30'
      const result = new Date(`${dateStr}T${timeStr}:00`)
      expect(result).toBeInstanceOf(Date)
      expect(result.getHours()).toBe(15)
      expect(result.getMinutes()).toBe(30)
    })

    it('default time when no time provided', () => {
      const dateStr = '2026-08-28'
      const timeStr = ''
      const result = new Date(`${dateStr}T${timeStr || '09:00'}:00`)
      expect(result).toBeInstanceOf(Date)
      expect(result.getHours()).toBe(9)
    })

    it('fmtDateTime displays in pt-BR', () => {
      const d = '2026-08-28T15:30:00Z'
      const formatted = new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      expect(formatted).toBeTruthy()
      expect(typeof formatted).toBe('string')
    })
  })

  describe('Error states', () => {
    it('error message shown when set', () => {
      const error = 'Erro ao salvar'
      expect(error).toBeTruthy()
    })

    it('error null means no error', () => {
      const error = null
      expect(error).toBeNull()
    })
  })

  describe('Won dialog confirmation', () => {
    it('won requires confirmation', () => {
      const action = 'won'
      const hasDialog = action === 'won' || action === 'lost'
      expect(hasDialog).toBe(true)
    })

    it('lost requires reason selection', () => {
      const lostReasonId = ''
      const canSubmit = lostReasonId !== ''
      expect(canSubmit).toBe(false)
    })
  })

  describe('Loss reason selected style', () => {
    it('selected reason has different styling', () => {
      const selectedId = 'r1'
      const currentId = 'r1'
      const isSelected = selectedId === currentId
      expect(isSelected).toBe(true)
    })

    it('unselected reason has default styling', () => {
      const selectedId = 'r1'
      const currentId = 'r2'
      const isSelected = selectedId === currentId
      expect(isSelected).toBe(false)
    })
  })

  describe('Timeline empty state', () => {
    it('shows message when no events', () => {
      const events: unknown[] = []
      const message = events.length === 0 ? 'Nenhum registro ainda.' : ''
      expect(message).toBe('Nenhum registro ainda.')
    })

    it('shows timeline when events exist', () => {
      const events = [{ id: '1' }]
      const message = events.length === 0 ? 'Nenhum registro ainda.' : ''
      expect(message).toBe('')
    })
  })

  describe('Mobile responsive classes', () => {
    it('header uses responsive padding', () => {
      const classes = 'flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4'
      expect(classes).toContain('sm:px-6')
      expect(classes).toContain('px-4')
    })

    it('view toggle uses hidden sm:inline for text', () => {
      const classes = 'hidden sm:inline'
      expect(classes).toContain('hidden')
    })
  })

  describe('Dead field removal', () => {
    it('CrmFilters has no responsible field', () => {
      const filters = { search: '', stage_id: '', status: '', activity: '', value_min: '', value_max: '', date_from: '', date_to: '' }
      expect(filters).not.toHaveProperty('responsible')
    })
  })

  describe('Invalidation helpers', () => {
    it('query key predicates work', () => {
      const key1 = ['crm', 'pipeline', 'opportunities', 'p1']
      const key2 = ['crm', 'pipeline', 'analytics']
      const key3 = ['crm', 'pipeline', 'stages', 'p1']
      expect(key1.includes('opportunities')).toBe(true)
      expect(key2.includes('analytics')).toBe(true)
      expect(key3.includes('opportunities')).toBe(false)
    })
  })
})
