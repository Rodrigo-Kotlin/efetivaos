import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createRule, listRules, setRuleActive, updateRule } from './rules-api'
import type { RuleInput } from './rules-types'

export const ruleKeys = {
  all: ['rules'] as const,
  list: () => [...ruleKeys.all, 'list'] as const,
}

export function useRules() {
  return useQuery({ queryKey: ruleKeys.list(), queryFn: listRules })
}

function useInvalidateRules() {
  const client = useQueryClient()
  return () => Promise.all([
    client.invalidateQueries({ queryKey: ruleKeys.list() }),
    client.invalidateQueries({ queryKey: ['comparison'] }),
  ])
}

export function useCreateRule() {
  const invalidate = useInvalidateRules()
  return useMutation({ mutationFn: createRule, onSuccess: () => invalidate() })
}

export function useUpdateRule() {
  const invalidate = useInvalidateRules()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RuleInput }) => updateRule(id, input),
    onSuccess: () => invalidate(),
  })
}

export function useSetRuleActive() {
  const invalidate = useInvalidateRules()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setRuleActive(id, active),
    onSuccess: () => invalidate(),
  })
}
