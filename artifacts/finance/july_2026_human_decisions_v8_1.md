# FIN-IMPORT-8.1 — Decisões humanas consolidadas de Julho/2026

## Status

`FIN-IMPORT-8.1 = COMPLETE`  
`PENDING_FACTS = 37`  
`CONSOLIDATED_HUMAN_DECISIONS = 19`  
`READY_FOR_HUMAN_DECISIONS = YES`  
`READY_FOR_FIN_IMPORT_8_2 = NO`  
`READY_FOR_IMPORT = NO`

Execução 100% read-only em DEV. PROD não foi acessado. Não houve importação, batch, journal, lock, migration, alteração de fonte, commit ou push.

## Pendências originais

- DECISION_REQUIRED: **27**
- POTENTIAL_DUPLICATE: **8**
- PRIOR_PERIOD_REVIEW: **1**
- UNRESOLVED_ALLOCATION: **1**
- Total: **37 fatos**

Os três registros de resumo foram normalizados nesta nova matriz com IDs provisórios distintos: Entrada NU = FLX-2026-0659, Empréstimo (S) = FLX-2026-0660 e Empréstimo (E) = FLX-2026-0661. Os artefatos originais do FIN-IMPORT-8.0 não foram alterados.

# DECISÕES HUMANAS NECESSÁRIAS — JULHO/2026

Responda, por exemplo, com `001-A`, `002-C` etc. Onde houver várias linhas, a resposta vale para o grupo salvo indicação por linha.

## JUL-DEC-001 — EMPRESTIMOS

- Fatos: FLX-2026-0661
- Datas: não informada
- Total: **R$ 9.000,00**
- Descrições: Empréstimo (E) (R$ 9.000,00)

**Pergunta:** A entrada de R$ 9.000,00 foi qual evento?

**Opções:**
- A — Empréstimo recebido pela Efetiva; B — Aporte dos sócios; C — Transferência entre contas próprias; D — Receita de cliente; E — Outro; F — Não sei

- Recomendação preliminar: Confirmar credor, data real e contrato. Não tratar como receita sem evidência.
- Impacto contábil: Registro de financiamento e contraparte; data atualmente não informada.
- `dre_effect` auxiliar: NONE; principal de empréstimo não é receita operacional.
- DRE oficial esperada: account.dre_class = NONE para principal, após conta aprovada.
- Impacto DFC: FINANCING se empréstimo; outra natureza somente após decisão.
- Impacto patrimonial: Aumenta passivo ou patrimônio conforme documentação.
- Resposta: **PENDING**

## JUL-DEC-002 — EMPRESTIMOS

- Fatos: FLX-2026-0660
- Datas: não informada
- Total: **R$ 9.752,65**
- Descrições: Empréstimo (S) (R$ 9.752,65)

**Pergunta:** A saída de R$ 9.752,65 foi qual evento?

**Opções:**
- A — Amortização de principal; B — Empréstimo concedido a terceiro; C — Principal + juros/tarifas com composição documentada; D — Outro; E — Não sei

- Recomendação preliminar: Informar contraparte, data e composição; não inventar split.
- Impacto contábil: Pode reduzir passivo ou criar ativo; juros/tarifas só com evidência.
- `dre_effect` auxiliar: Principal: NONE; juros/tarifas somente após composição e conta aprovada.
- DRE oficial esperada: account.dre_class da natureza aprovada; principal não compõe DRE.
- Impacto DFC: FINANCING se amortização; INVESTING/conta a receber se empréstimo concedido.
- Impacto patrimonial: Reduz passivo ou cria ativo; composição desconhecida.
- Resposta: **PENDING**

## JUL-DEC-003 — TRANSFERENCIAS_NU

- Fatos: FLX-2026-0659
- Datas: não informada
- Total: **R$ 12.000,00**
- Descrições: Entrada NU (R$ 12.000,00)

**Pergunta:** A entrada NU de R$ 12.000,00 corresponde a qual transferência?

**Opções:**
- A — NU → Cora; B — Outra conta própria → Cora; C — Não é transferência interna; D — Outro; E — Não sei

- Recomendação preliminar: Informar origem, data real e confirmar se existe saída espelhada na conta NU.
- Impacto contábil: Origem/destino e data ainda faltantes; manter como transferência provisória, não receita.
- `dre_effect` auxiliar: NONE; transferência interna não compõe DRE.
- DRE oficial esperada: account.dre_class = NONE.
- Impacto DFC: Transferência interna; efeito consolidado zero se o espelho existir.
- Impacto patrimonial: Move saldo entre contas próprias; não cria receita/despesa.
- Resposta: **PENDING**

## JUL-DEC-004 — CARTOES

- Fatos: FLX-2026-0621, FLX-2026-0652
- Datas: 2026-07-15; 2026-07-31
- Total: **R$ 663,47**
- Descrições: Fatura Cartao Cora (R$ 173,34); Fatura Cartão Caixa (R$ 490,13)

**Pergunta:** Os pagamentos das faturas Cora (R$ 173,34) e Caixa (R$ 490,13), total R$ 663,47, têm compras componentes reconhecidas?

**Opções:**
- A — Componentes já lançados; faturas são apenas liquidação; B — Componentes não lançados; tratar após fornecer composição; C — Composição desconhecida; manter bloqueados; D — Outro; E — Não sei

- Recomendação preliminar: Confirmar cada fatura e sua composição antes de lançar despesas.
- Impacto contábil: Pagamento de fatura não deve duplicar compras; componentes e conta do cartão precisam ser identificados.
- `dre_effect` auxiliar: A: NONE no pagamento; B: DRE pelas compras após composição.
- DRE oficial esperada: account.dre_class das compras componentes, se existirem; pagamento da fatura = NONE.
- Impacto DFC: Saída financeira permanece; classificação consolidada depende dos componentes.
- Impacto patrimonial: Baixa saldo do cartão; pode criar despesa/obrigação conforme composição.
- Resposta: **PENDING**

## JUL-DEC-005 — DUPLICIDADES

- Fatos: FLX-2026-0595, FLX-2026-0596
- Datas: 2026-07-06
- Total: **R$ 2.998,86**
- Descrições: Salário Luciana (R$ 1.499,43); Salário Randrea (R$ 1.499,43)

**Pergunta:** Luciana e Randrea foram pagamentos reais e distintos apesar de mesmo valor e data?

**Opções:**
- A — Sim, manter ambos; B — Um lançamento é duplicado; C — Um deles tem outra natureza/beneficiário; D — Não sei

- Recomendação preliminar: Validar comprovantes, nomes e folha; não excluir automaticamente.
- Impacto contábil: Dois pagamentos de R$ 1.499,43 em 06/07; risco é de duplicidade factual, não apenas de classificação.
- `dre_effect` auxiliar: Salários reais podem afetar DRE; duplicidade deve ser eliminada antes da apresentação.
- DRE oficial esperada: account.dre_class da conta de pessoal aprovada.
- Impacto DFC: Saída operacional permanece somente para pagamentos reais.
- Impacto patrimonial: Mantém duas liquidações ou elimina uma obrigação, conforme prova.
- Resposta: **PENDING**

## JUL-DEC-006 — DUPLICIDADES

- Fatos: FLX-2026-0598, FLX-2026-0599, FLX-2026-0600, FLX-2026-0601
- Datas: 2026-07-06
- Total: **R$ 12.000,00**
- Descrições: Pagamento BC Danillo (R$ 3.000,00); Pagamento BC Allan (R$ 3.000,00); Pagamento BC Souza (R$ 3.000,00); Pagamento David (R$ 3.000,00)

**Pergunta:** Os quatro pagamentos de Bombeiro Civil de R$ 3.000,00 em 06/07 são beneficiários distintos e reais?

**Opções:**
- A — Sim, quatro pagamentos distintos; B — Um ou mais são duplicados; C — Valores representam composição diferente; D — Não sei

- Recomendação preliminar: Validar nomes completos, contratos e comprovantes de Danillo, Allan, Souza e David.
- Impacto contábil: Alerta baseado em mesma data/valor; não há evidência suficiente para eliminar ou agrupar.
- `dre_effect` auxiliar: Custos reais seguem a conta aprovada; duplicidade não pode gerar dupla DRE.
- DRE oficial esperada: account.dre_class da conta de custo aprovada.
- Impacto DFC: Saída operacional somente para pagamentos reais.
- Impacto patrimonial: Mantém quatro liquidações ou reduz obrigações se duplicidade comprovada.
- Resposta: **PENDING**

## JUL-DEC-007 — PESSOAL_RODRIGO

- Fatos: FLX-2026-0597, FLX-2026-0610, FLX-2026-0623, FLX-2026-0631
- Datas: 2026-07-06; 2026-07-07; 2026-07-15; 2026-07-22
- Total: **R$ 3.080,00**
- Descrições: Prestação de serviço Rodrigo (R$ 1.500,00); Vale Rodrigo (R$ 500,00); Pagamento restante Rodrigo (R$ 1.000,00); Vale Rodrigo (R$ 80,00)

**Pergunta:** Os quatro lançamentos de Rodrigo, total R$ 3.080,00, devem ser tratados como salário, adiantamento, prestação de serviço, pró-labore ou outra natureza?

**Opções:**
- A — Remuneração/salário; B — Adiantamento a empregado (1.1.02.003); C — Prestação de serviço; D — Pró-labore; E — Reembolso/ajuda de custo; F — Mistura: informar natureza por linha; G — Não sei

- Recomendação preliminar: Usar a decisão de Junho apenas como referência: confirmar a natureza de Julho por linha, especialmente os R$ 1.500,00 e R$ 1.000,00 de serviço/restante.
- Impacto contábil: Linhas: prestação R$ 1.500,00, vale R$ 500,00, restante R$ 1.000,00 e vale R$ 80,00. Pode exigir conta patrimonial para adiantamentos.
- `dre_effect` auxiliar: Depende da opção; adiantamento/reembolso pode ser patrimonial.
- DRE oficial esperada: account.dre_class da conta escolhida; não usar dre_effect como base oficial.
- Impacto DFC: Saída de caixa já ocorreu; natureza DFC depende da decisão.
- Impacto patrimonial: Pode reconhecer despesa, adiantamento ou obrigação.
- Resposta: **PENDING**

## JUL-DEC-008 — PESSOAL_JANDERSON

- Fatos: FLX-2026-0603, FLX-2026-0624
- Datas: 2026-07-07; 2026-07-15
- Total: **R$ 1.750,00**
- Descrições: Ajuda de combustível Janderson (R$ 500,00); Vale Janderson (R$ 1.250,00)

**Pergunta:** A ajuda de combustível de R$ 500,00 e o vale de R$ 1.250,00 de Janderson, total R$ 1.750,00, são salário, adiantamentos ou benefícios?

**Opções:**
- A — Salário/remuneração; B — Adiantamento a empregado (1.1.02.003); C — Ajuda de custo/reembolso; D — Natureza mista: informar por linha; E — Outro; F — Não sei

- Recomendação preliminar: Confirmar natureza por linha e centro de custo definitivo; não presumir o tratamento de Junho.
- Impacto contábil: Adiantamentos devem permanecer patrimoniais até baixa, se essa for a decisão; ajuda de custo pode ser despesa.
- `dre_effect` auxiliar: Depende da conta oficial; adiantamento pode não afetar DRE imediato.
- DRE oficial esperada: account.dre_class da conta escolhida.
- Impacto DFC: Saída operacional ou movimento patrimonial conforme natureza.
- Impacto patrimonial: Pode criar/baixar ativo de adiantamento ou reconhecer despesa.
- Resposta: **PENDING**

## JUL-DEC-009 — PESSOAL_VALDILENE

- Fatos: FLX-2026-0612, FLX-2026-0650
- Datas: 2026-07-07; 2026-07-30
- Total: **R$ 3.500,00**
- Descrições: Vale Valdilene (R$ 2.500,00); Vale Valdilene (R$ 1.000,00)

**Pergunta:** Os vales de Valdilene, R$ 2.500,00 e R$ 1.000,00, total R$ 3.500,00, são adiantamentos a sócia/administradora?

**Opções:**
- A — Adiantamentos a sócios/administradores (1.1.02.006); B — Pró-labore/remuneração; C — Prestação de serviço; D — Reembolso/ajuda de custo; E — Outro; F — Não sei

- Recomendação preliminar: Confirmar natureza e vínculo com a referência de Junho; não aplicar automaticamente o tratamento anterior.
- Impacto contábil: A opção A é patrimonial até baixa; demais opções podem afetar resultado conforme conta.
- `dre_effect` auxiliar: Depende da conta escolhida; adiantamento não é despesa.
- DRE oficial esperada: account.dre_class da conta escolhida.
- Impacto DFC: Saída operacional se despesa; adiantamento permanece patrimonial.
- Impacto patrimonial: Pode aumentar/baixar adiantamento a sócio ou reconhecer obrigação/despesa.
- Resposta: **PENDING**

## JUL-DEC-010 — COMPETENCIA_ANTERIOR_PESSOAL

- Fatos: FLX-2026-0653
- Datas: 2026-07-31
- Total: **R$ 3.100,00**
- Descrições: Pagamento prestação de serviços Valdilene 2025 (R$ 3.100,00)

**Pergunta:** O pagamento de R$ 3.100,00 descrito como “prestação de serviços Valdilene 2025” refere-se a qual mês/competência e já foi reconhecido?

**Opções:**
- A — Dívida de 2025 já reconhecida; baixar passivo; B — Despesa de Julho; C — Adiantamento/ativo; D — Outro; E — Não sei

- Recomendação preliminar: Informar mês de origem, existência do passivo e evidência. Não reabrir mês fechado nem criar AR/AP fictício.
- Impacto contábil: Pagamento pode ser baixa de passivo histórico ou reconhecimento no período aprovado.
- `dre_effect` auxiliar: Baixa de passivo: NONE em Julho; nova despesa: conta oficial do período aprovado.
- DRE oficial esperada: account.dre_class da conta aprovada se nova despesa; NONE se baixa de passivo.
- Impacto DFC: Saída de caixa em Julho; DFC operacional conforme política.
- Impacto patrimonial: Baixa passivo histórico ou reconhece despesa/obrigação, conforme prova.
- Resposta: **PENDING**

## JUL-DEC-011 — ALIMENTACAO

- Fatos: FLX-2026-0589
- Datas: 2026-07-07
- Total: **R$ 2.052,34**
- Descrições: Alimentação (R$ 2.052,34)

**Pergunta:** A alimentação de R$ 2.052,34 está vinculada a viagem/projeto específico ou é despesa administrativa?

**Opções:**
- A — Clínica; B — Engenharia/SST; C — Bombeiros; D — Administrativo/Corporativo; E — Outro; F — Não sei

- Recomendação preliminar: Informar beneficiários, finalidade e centro; não inventar rateio.
- Impacto contábil: Conta e centro ainda dependem da finalidade documentada.
- `dre_effect` auxiliar: Despesa de alimentação auxiliar; natureza final depende da conta.
- DRE oficial esperada: account.dre_class da conta aprovada.
- Impacto DFC: Saída operacional; centro pode alterar apenas análise gerencial.
- Impacto patrimonial: Reconhece despesa ou eventual adiantamento/reembolso conforme prova.
- Resposta: **PENDING**

## JUL-DEC-012 — MATERIAIS_E_CONSUMO

- Fatos: FLX-2026-0604, FLX-2026-0613
- Datas: 2026-07-07; 2026-07-11
- Total: **R$ 695,18**
- Descrições: Materiais de limpeza (R$ 197,44); Insumos de Limpeza clínica (R$ 497,74)

**Pergunta:** Os materiais de limpeza, total R$ 695,18, são consumo imediato ou estoque/insumo clínico?

**Opções:**
- A — Despesa de consumo administrativa; B — Custo/insumo da Clínica; C — Estoque/ativo até consumo; D — Outro; E — Não sei

- Recomendação preliminar: Confirmar local de uso e política de estoque; não inventar rateio.
- Impacto contábil: Duas linhas: R$ 197,44 e R$ 497,74; conta/centro dependem do uso.
- `dre_effect` auxiliar: Despesa/custo quando consumido; estoque não afeta DRE no pagamento.
- DRE oficial esperada: account.dre_class da conta oficial após definir consumo, custo ou estoque.
- Impacto DFC: Saída operacional; estoque é movimento patrimonial.
- Impacto patrimonial: Pode reconhecer despesa/custo ou ativo de estoque.
- Resposta: **PENDING**

## JUL-DEC-013 — TELEFONIA_INTERNET

- Fatos: FLX-2026-0616, FLX-2026-0617, FLX-2026-0634, FLX-2026-0651
- Datas: 2026-07-13; 2026-07-27; 2026-07-31
- Total: **R$ 354,82**
- Descrições: Internet Vivo (R$ 101,22); Conta vivo (R$ 64,00); Internet Vivo (R$ 102,24); Fatura Vivo (R$ 87,36)

**Pergunta:** As quatro cobranças Vivo, total R$ 354,82, pertencem a quais linhas/unidades e centros?

**Opções:**
- A — Clínica; B — Engenharia/SST; C — Administrativo/Corporativo; D — Ratear com percentuais informados; E — Outra unidade; F — Não sei

- Recomendação preliminar: Fornecer número/unidade e, se compartilhado, rateio aprovado; não inventar percentuais.
- Impacto contábil: A classificação depende da unidade/linha; os lançamentos permanecem individualmente rastreáveis.
- `dre_effect` auxiliar: Despesa de telefonia auxiliar; rateio não muda a natureza econômica.
- DRE oficial esperada: account.dre_class da conta oficial.
- Impacto DFC: Saída operacional da unidade confirmada.
- Impacto patrimonial: Reconhece obrigação/despesa da unidade confirmada.
- Resposta: **PENDING**

## JUL-DEC-014 — CAPACITACAO

- Fatos: FLX-2026-0619, FLX-2026-0620, FLX-2026-0630
- Datas: 2026-07-14; 2026-07-21
- Total: **R$ 399,88**
- Descrições: AIBR Instituição  - curso (R$ 54,79); GINEAD Curso (R$ 49,70); Uniunica Edeucação cursos (R$ 295,39)

**Pergunta:** Os três cursos, total R$ 399,88, beneficiam qual centro ou pessoa?

**Opções:**
- A — Clínica; B — Engenharia/SST; C — Administrativo/Corporativo; D — Pessoal específico; E — Outro; F — Não sei

- Recomendação preliminar: Informar beneficiário e centro; não aplicar automaticamente Administrativo.
- Impacto contábil: Conta de capacitação pode permanecer, mas centro beneficiado está pendente.
- `dre_effect` auxiliar: Despesa de capacitação auxiliar.
- DRE oficial esperada: account.dre_class da conta aprovada.
- Impacto DFC: Saída operacional do centro/beneficiário confirmado.
- Impacto patrimonial: Reconhece despesa da unidade/beneficiário confirmado.
- Resposta: **PENDING**

## JUL-DEC-015 — ALOCACAO_BLBO

- Fatos: FLX-2026-0614
- Datas: 2026-07-13
- Total: **R$ 250,00**
- Descrições: B L B de Oliveira (R$ 250,00)

**Pergunta:** Qual é a natureza e o centro de custo de B L B de Oliveira, R$ 250,00?

**Opções:**
- A — Custo Clínica; B — Despesa Administrativa; C — Serviço/pessoal; D — Adiantamento/reembolso; E — Outro; F — Não sei

- Recomendação preliminar: Fornecer contraparte, documento, finalidade e centro; não inventar rateio ou conta.
- Impacto contábil: A fonte está como “A classificar”/CC99; nenhuma opção pode ser escolhida sem evidência.
- `dre_effect` auxiliar: Indefinido até identificar natureza; não inventar custo/despesa.
- DRE oficial esperada: account.dre_class somente após conta aprovada.
- Impacto DFC: Operacional, patrimonial ou outro conforme natureza.
- Impacto patrimonial: Pode criar fornecedor, obrigação, adiantamento ou despesa.
- Resposta: **PENDING**

## JUL-DEC-016 — ENERGIA_NEGOCIACAO

- Fatos: FLX-2026-0638, FLX-2026-0639
- Datas: 2026-07-27
- Total: **R$ 1.850,53**
- Descrições: Equatorial (R$ 1.008,90); Negociação Equatorial (R$ 841,63)

**Pergunta:** Equatorial e Negociação Equatorial, total R$ 1.850,53, são fatura corrente, dívida anterior ou parcelamento?

**Opções:**
- A — Fatura corrente; B — Dívida anterior/negociação; C — Parcelamento: informar composição; D — Mistura; E — Não sei

- Recomendação preliminar: Informar competência das duas cobranças e composição da negociação; não duplicar fatura e parcela.
- Impacto contábil: Pode ser despesa corrente, baixa de passivo antigo ou parcelamento.
- `dre_effect` auxiliar: Fatura corrente pode afetar DRE; dívida/juros anteriores dependem da composição.
- DRE oficial esperada: account.dre_class da conta; juros/multas somente com composição.
- Impacto DFC: Saída operacional/baixa de passivo conforme natureza.
- Impacto patrimonial: Reconhece despesa, passivo ou baixa de dívida histórica.
- Resposta: **PENDING**

## JUL-DEC-017 — MATERIAIS_ADMINISTRATIVOS

- Fatos: FLX-2026-0618
- Datas: 2026-07-13
- Total: **R$ 156,64**
- Descrições: Insumos de escritório (R$ 156,64)

**Pergunta:** Insumos de escritório de R$ 156,64 são consumo administrativo, estoque ou outro?

**Opções:**
- A — Despesa administrativa; B — Estoque/ativo até uso; C — Outro centro; D — Não sei

- Recomendação preliminar: Confirmar natureza e local de uso; não inventar estoque.
- Impacto contábil: Conta pode ser consumo ou ativo/estoque conforme evidência.
- `dre_effect` auxiliar: Despesa de material auxiliar se consumo; estoque não afeta DRE no pagamento.
- DRE oficial esperada: account.dre_class da conta oficial.
- Impacto DFC: Saída operacional ou movimento patrimonial se estoque.
- Impacto patrimonial: Pode reconhecer despesa ou ativo de estoque.
- Resposta: **PENDING**

## JUL-DEC-018 — PEQUENAS_AQUISICOES

- Fatos: FLX-2026-0627, FLX-2026-0640
- Datas: 2026-07-17; 2026-07-28
- Total: **R$ 90,00**
- Descrições: Cópia de Chaves (R$ 30,00); Carregador Celular e capa (R$ 60,00)

**Pergunta:** Cópia de chaves (R$ 30,00) e carregador/capa (R$ 60,00), total R$ 90,00, são consumo, manutenção ou ativo?

**Opções:**
- A — Despesa administrativa; B — Manutenção/infraestrutura; C — Ativo/objeto durável; D — Outro; E — Não sei

- Recomendação preliminar: Confirmar finalidade e materialidade; manter itens separados na rastreabilidade.
- Impacto contábil: A natureza contábil depende do uso e materialidade; não capitalizar automaticamente.
- `dre_effect` auxiliar: Despesa se consumo/manutenção; ativo não compõe DRE no pagamento.
- DRE oficial esperada: account.dre_class da conta oficial após definição.
- Impacto DFC: Saída operacional ou investimento/ativo conforme decisão.
- Impacto patrimonial: Pode reconhecer despesa ou ativo conforme materialidade e uso.
- Resposta: **PENDING**

## JUL-DEC-019 — COMPETENCIA_ANTERIOR

- Fatos: FLX-2026-0628
- Datas: 2026-09-17
- Total: **R$ 503,41**
- Descrições: Material de cozinha (R$ 503,41)

**Pergunta:** Material de cozinha, R$ 503,41, possui data de origem 17/09/2026 embora esteja na aba Julho. Qual competência deve prevalecer?

**Opções:**
- A — Julho/2026 por competência/caixa comprovada; B — Setembro/2026 pela data da fonte; C — Outro período; D — Fonte deve ser corrigida pelo responsável; E — Não sei

- Recomendação preliminar: Confirmar data real, competência e comprovante. Não carregar em Julho nem corrigir a fonte automaticamente.
- Impacto contábil: A data da fonte está fora de Julho; mês original aparente é Setembro/2026, mas reconhecimento anterior é desconhecido.
- `dre_effect` auxiliar: DRE no período da conta/account.dre_class aprovado; competência ainda pendente.
- DRE oficial esperada: account.dre_class da conta no período validado.
- Impacto DFC: Caixa ocorre conforme data bancária, mas competência pode diferir.
- Impacto patrimonial: Pode exigir passivo/competência; não reabrir meses fechados.
- Resposta: **PENDING**

## Mapa técnico

Todos os 37 fatos pendentes estão vinculados a exatamente uma decisão em `july_2026_fact_to_decision_map_v8_1.csv`.

## Regras preservadas

- Datas ausentes permanecem “não informada”; nenhuma data foi inventada.
- Não foi inventado split de principal, juros ou tarifas.
- Transferência interna não foi tratada como receita/despesa.
- `dre_effect` permanece auxiliar; a DRE oficial futura seguirá `account.dre_class`.
- Meses fechados não serão reabertos e não foi criado AR/AP fictício.
