# FIN-IMPORT-5.3G — Auditoria do contrato de hash do manifesto

## Status

**COMPLETED** — o contrato foi normalizado no DEV sem executar Abril.

## Root cause

- Category: **RAW_FILE_BYTES_VS_JSONB_SERIALIZATION**
- Contributing transport issue: **CLIENT_SERIALIZATION / LINE_ENDING_NORMALIZATION**
- Function argument before: `p_manifest_json text`
- Expression before: `encode(digest(convert_to(p_manifest_json, 'UTF8'), 'sha256'), 'hex')`
- Comparison before: payload textual bruto contra o SHA-256 dos bytes do arquivo.

O arquivo tem 168.996 caracteres e hash de bytes `6605…af662`. A representação
textual recebida pelo PostgreSQL pode conter normalização de transporte e não é a
representação `jsonb::text`; portanto, comparar o texto bruto recebido com o hash
do arquivo não era um contrato estável.

## Hashes

| Fingerprint | SHA-256 |
|---|---|
| File bytes | `6605a548fdb031d83e95e84945cb5853bbd816485eab17ed2b7bdc42749af662` |
| Client raw JSON text | `6605a548fdb031d83e95e84945cb5853bbd816485eab17ed2b7bdc42749af662` |
| Client compact JSON | `0caaea488e9aa8dbc2e5bc5c02396e22452ac3cff4dde75f66ff4fbcc19bcb6e` |
| Client canonical JSONB-compatible | `adf6e94c52bfe00a6c997127377f8ed4a8edc4db0ab501e3536fe84ebc5039f9` |
| Database `jsonb::text` | `adf6e94c52bfe00a6c997127377f8ed4a8edc4db0ab501e3536fe84ebc5039f9` |

Client/database canonical hashes: **EQUAL**.

## Canonicalization rule

The executor first parses `p_manifest_json::jsonb`, then hashes

```sql
encode(digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex')
```

The client reproduces PostgreSQL JSONB text deterministically: object keys are
ordered by UTF-8 byte length and then UTF-8 byte order; arrays preserve order;
JSONB text separators are `", "` and `": "`; values and fields are preserved.
This makes whitespace-only and key-order-only changes equivalent while semantic
changes produce a different hash.

## Proofs

- File hash: **PASS**
- Real manifest canonical hash: **PASS**
- Database canonical hash equals client: **PASS**
- Semantic amount mutation (+R$ 0,01): rejected by hash divergence — **PASS**
- Whitespace-only fixture: canonical hash unchanged — **PASS**
- Key-order-only fixture: canonical hash unchanged — **PASS**
- No fields, rows, classifications, or values were changed.

## Migration

Path:

`supabase/migrations/20261021180000_fix_april_2026_executor_manifest_hash_contract.sql`

Function:

`execute_authoritative_financial_import_april_2026(text,text,text)`

- File SHA validation preserved: **YES**
- Canonical logical payload validation added: **YES**
- Signature changed: **NO**
- Atomicity preserved: **YES**
- Idempotency preserved: **YES**
- Row coverage, taxonomy, DRE totals, journals and closed-period checks preserved:
  **YES**
- Security definer and hardened search path preserved: **YES**
- Grants/RLS/default privileges changed: **NO**

## Tests

Remote DEV tests:

- Hash contract, semantic mutation, whitespace, key order: **PASS**
- 92-row coverage and executor security/atomicity: **PASS**
- DRE bucket totals: **PASS**
- DRE presentation contract: **PASS**
- Remote SQL tests: **4/4 PASS**

## DEV application and safety

- Project: `bxviuzluxcijbqqbpyzb`
- Migration applied: **YES**
- Function exists: **YES**
- `SECURITY DEFINER`: **YES**
- April batches: 0
- April import rows: 0
- April transactions: 0
- April journals: 0
- Import state: **NOT_IMPORTED**
- January facts: 107
- February facts: 80
- March facts: 107
- Financial writes: 0
- Journal writes: 0
- Real April writes: 0
- PROD: **NO**
- Commit/push: **NO**

## Readiness

- `HASH_CONTRACT_FIXED`: **YES**
- `FILE_INTEGRITY_VALID`: **YES**
- `CANONICAL_PAYLOAD_INTEGRITY_VALID`: **YES**
- `CLIENT_DATABASE_HASH_MATCH`: **YES**
- `ATOMIC_EXECUTOR_STILL_VALID`: **YES**
- `APRIL_REAL_DATA_IMPORTED`: **NO**
- `READY_FOR_FIN_IMPORT_5_3H_RETRY`: **YES**

Abril não foi executado, PROD não foi tocado, Maio não foi iniciado e não houve
commit/push.
