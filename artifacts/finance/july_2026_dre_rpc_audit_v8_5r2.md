# DRE RPC audit — FIN-IMPORT-8.5R2

Read-only DEV audit.

- RPC: `get_income_statement(date,date,uuid,uuid)`
- Security: SECURITY DEFINER
- Required context: `auth.uid()` and `is_internal_user()`
- Grants: authenticated, service_role, postgres
- Result: `RPC_NOT_EXECUTABLE_FROM_CURRENT_CLI_CONTEXT`
- `DRE_RPC_FAILURE_CLASS = C` (authentication context)

The CLI session cannot legitimately execute the RPC without a user authentication context. No auth, grant, RLS, or user changes were made. The audited SQL rule and direct calculation use account.dre_class, account nature, settled journal lines, and competence_date.

## Direct reconciliation

- Revenue: R$ 65.264,61
- Costs: R$ 22.438,32
- Expenses: R$ 41.923,54
- Result: R$ 902,75
- Formula: 65.264,61 - 22.438,32 - 41.923,54 = 902,75

`DIRECT_DRE_RECONCILIATION = PASS`
`DRE_VALIDATION = PASS_WITH_AUTH_CONTEXT_LIMITATION`
