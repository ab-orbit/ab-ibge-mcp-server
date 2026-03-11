# Correção do Erro HTTP 500 no IPCA Acumulado

## Problema Identificado

O agente IBGE retornava erro 500 ao tentar consultar o IPCA acumulado dos últimos 12 meses com a chamada:
```python
ibge_ipca(ultimos_meses=12, tipo='variacao_acumulada_12_meses')
```

## Causa Raiz

**ID de variável incorreto na tabela SIDRA 1419**

O código original usava:
```typescript
const varMap = {
  variacao_mensal: "63",
  variacao_acumulada_ano: "69",
  variacao_acumulada_12_meses: "2266"  // ❌ INCORRETO
};
```

Mas a variável correta da API IBGE é:
```typescript
const varMap = {
  variacao_mensal: "63",                    // ✅ IPCA - Variação mensal
  variacao_acumulada_ano: "69",             // ✅ IPCA - Variação acumulada no ano
  variacao_acumulada_12_meses: "2265"       // ✅ IPCA - Variação acumulada em 12 meses
};
```

## Verificação

Consulta às variáveis da tabela 1419 (IPCA):
```bash
curl -s "https://servicodados.ibge.gov.br/api/v3/agregados/1419/metadados" | jq '.variaveis[]'
```

Resultado:
- **ID 63**: IPCA - Variação mensal
- **ID 69**: IPCA - Variação acumulada no ano
- **ID 2265**: IPCA - Variação acumulada em 12 meses ✅
- **ID 66**: IPCA - Peso mensal
- **ID 2266**: ❌ NÃO EXISTE

## Solução Aplicada

1. **Corrigido ID da variável**: `2266` → `2265` em `src/tools/sidra.ts:415`
2. **Recompilado o código**: `npm run build`
3. **Atualizada versão**: `2.0.0` → `2.0.1` (patch)
4. **Testado endpoint**: Status 200 ✅

## Teste da Correção

### URL corrigida (funciona):
```bash
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  "https://servicodados.ibge.gov.br/api/v3/agregados/1419/periodos/last%2012/variaveis/2265?localidades=N1%5Ball%5D"
# Resultado: Status: 200
```

### URL antiga (erro):
```bash
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  "https://servicodados.ibge.gov.br/api/v3/agregados/1419/periodos/last%2012/variaveis/2266?localidades=N1%5Ball%5D"
# Resultado: Status: 500 (variável não existe)
```

## Como Testar no Agente Python

1. Certifique-se de que o servidor MCP foi recompilado:
   ```bash
   cd /Users/jwcunha/Downloads/ibge-mcp-server
   npm run build
   ```

2. Reinicie o servidor MCP no agente (o Python deve apontar para `dist/index.js`)

3. Execute a consulta problemática:
   ```python
   python agente_ibge_v3.py
   # Digite: "acumulado ipca ultimos 12 meses?"
   ```

4. Resultado esperado:
   ```
   📡 Buscando dados IBGE:
   🔧 ibge_ipca(ultimos_meses=12, tipo='variacao_acumulada_12_meses')
      ↳ ✅ Dados retornados com sucesso

   IPCA — variacao acumulada 12 meses (últimos 12 meses)
   📊 Brasil: [valores por período]
   ```

## Arquivos Alterados

- ✅ `src/tools/sidra.ts` (linha 415: variável ID corrigida)
- ✅ `CHANGELOG.md` (documentação da correção)
- ✅ `package.json` (versão bumped para 2.0.1)
- ✅ `dist/` (recompilado)

## Publicação

Para publicar a correção no npm:
```bash
npm run build
npm publish
```

Usuários atualizarão com:
```bash
npm install -g ab-ibge-mcp-server@latest
```
