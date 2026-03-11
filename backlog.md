Boa análise para fazer com profundidade. Com o que sei sobre a API completa do IBGE + o que já temos no servidor, aqui está o diagnóstico:

🗺️ Cobertura atual vs. superfície total da API
APIs do IBGE com zero cobertura
1. Nomes (/api/v2/censos/nomes) — ausência mais grave para v0
GET /censos/nomes/{nome}           → frequência histórica por décadas
GET /censos/nomes/ranking          → top nomes nacional
GET /censos/nomes/ranking?localidade=35  → top nomes em SP
GET /censos/nomes/{nome}?decada=1990     → nome na década 90
É a API mais viral do IBGE — "quantas pessoas se chamam João no Brasil?", "qual o nome mais popular da minha geração?" — uso altíssimo em produtos de consumo. Completamente ausente.
2. Calendário (/api/v3/calendario) — crítico para contexto econômico
GET /calendario                    → próximas divulgações do IBGE
GET /calendario/ipca               → quando sai o próximo IPCA
GET /calendario/pnad               → próxima PNAD Contínua
Sem isso, Claude não consegue dizer "o próximo IPCA sai em X dias" nem contextualizar quando um dado foi divulgado.
3. Localidades incompletas — hierarquia geográfica quebrada
GET /localidades/mesorregioes         → 137 mesorregiões (ex: Sul Baiano)
GET /localidades/microrregioes        → 558 microrregiões
GET /localidades/distritos            → ~10k distritos
GET /localidades/regioes-imediatas    → nova divisão de 2017, 510 regiões
GET /localidades/regioes-intermediarias → nova divisão, 133 regiões
As regiões imediatas/intermediárias substituíram meso/micro no planejamento federal desde 2017. Qualquer consulta moderna de política pública usa essa divisão e hoje o servidor nem as conhece.
4. Pesquisas (/api/v1/pesquisas) — ferramenta de descoberta ausente
GET /pesquisas                     → todas as pesquisas IBGE com metadados
GET /pesquisas/{id}                → detalhes: periodicidade, cobertura, variáveis
Sem isso, Claude precisa "adivinhar" IDs de agregados. Essa API é o índice de tudo.

Dados de alta demanda não cobertos via SIDRA
O servidor cobre IPCA, PIB municipal, população e alfabetização. Faltam dados que são o pão do dia de analistas:
PesquisaTabela SIDRADemandaEstimativas pop. anuais (TCU)6579Alta — censo é de 5 em 5 anos, estimativas são anuaisPIB estadual5938Alta — temos municipal mas não estadualPNAD Contínua — desemprego6381AltíssimaPNAD Contínua — informalidade6320AltaPNAD Contínua — rendimento por escolaridade7440AltaProdução Agrícola Municipal (PAM)5457Alta para agroPesquisa Pecuária Municipal (PPM)3939Alta para agroProjeções populacionais (até 2070)7358MédiaMUNIC — perfil municipal8418Média

Melhorias críticas nas tools existentes
ibge_buscar_municipio — normalização de entrada quebrada
Hoje falha com "Sao Paulo" (sem acento). Needs NFD + replace(/[\u0300-\u036f]/g, "") na comparação.
ibge_sidra_consultar_tabela — sem suporte a múltiplas variáveis
A API aceita variaveis=93|94|95 mas a tool só passa uma. Para PNAD, você sempre quer 3-4 variáveis juntas.
ibge_sidra_pesquisar_tabelas — descoberta semântica fraca
Retorna lista bruta. Claude fica perdido sem um catálogo de temas → tabelas mais úteis. Precisaria de um CATALOGO_PESQUISAS hardcoded com as ~30 tabelas mais usadas agrupadas por tema.
ibge_indicador_economico — 1 indicador por call
Alta latência do IBGE (1-2s/call). Para um "resumo econômico" Claude faz 5 calls seriais = 8-10s. Precisa suportar indicadores: string[] e fazer Promise.all.
ibge_populacao_municipio — só Censo 2022
Não retorna estimativas anuais (tabela 6579). Para municípios não finalizados no censo, retorna vazio sem dizer que existe estimativa disponível.

Problemas de DX que impedem produção no npm
1. Zero caching — A maior travação de UX
IBGE localidades:  24h TTL  (não muda)
IBGE nomes:         7d TTL  (não muda nunca)
SIDRA metadados:    6h TTL
SIDRA dados:        1h TTL  (IPCA sai mensalmente)
Sem cache, cada pergunta sobre estados faz 1 HTTP call. Com cache in-memory, resposta em <1ms.
2. Sem retry/backoff — IBGE retorna 503 com frequência
typescript// precisa de algo como:
async function ibgeFetch(url, retries = 3, delay = 500) {
  // exponential backoff on 503/504
}
3. Sem types exportados — pacote npm que não exporta tipos é inutilizável
O package.json precisa de "exports" com entrypoint de tipos para que quem usar import {} from 'ibge-mcp-server' tenha intellisense.
4. Sem validação de parâmetros amigável
Hoje erro de parâmetro retorna stack trace do IBGE. Precisa de mensagem actionable: "período '2024-13' inválido — use AAAAMM, ex: 202412".

Priorização para v0
Essencial (bloqueia v0):

 ibge_nomes_frequencia + ibge_nomes_ranking — feature mais viral
 ibge_estimativas_populacionais (tabela 6579) — censo tem gaps
 ibge_pib_estados (tabela 5938) — pergunta mais comum
 Cache in-memory com TTL — sem isso o produto é lento demais
 Normalização de nomes com acento no buscar_municipio
 Multi-variável no ibge_sidra_consultar_tabela

Importante (v0.1):

 ibge_calendario_divulgacoes — contexto temporal das respostas
 ibge_pnad_desemprego + ibge_pnad_rendimento — hardcoded sobre tabelas PNAD certas
 ibge_localidades_regioes_imediatas — divisão atual do IBGE
 Retry com backoff no ibgeFetch

Nice to have (v0.2+):

 PAM/PPM — dados agropecuários
 ibge_projecao_populacao — até 2070
 ibge_pesquisas_catalogo — índice de todas as pesquisas
 Exportação de tipos TypeScript