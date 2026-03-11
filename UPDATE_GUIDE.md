# 🔄 Guia de Atualização do Pacote npm

## Processo Completo para Atualizar o Pacote

### 1️⃣ Fazer as Melhorias no Código

```bash
# Trabalhe normalmente no código
# Edite os arquivos em src/
# Teste localmente
npm run dev
```

### 2️⃣ Testar as Mudanças

```bash
# Compile o projeto
npm run build

# Teste o servidor localmente
node dist/index.js
```

### 3️⃣ Atualizar a Versão (Semantic Versioning)

O npm usa **versionamento semântico** (MAJOR.MINOR.PATCH):

```bash
# Para CORREÇÕES DE BUGS (1.0.0 → 1.0.1)
npm version patch

# Para NOVAS FUNCIONALIDADES compatíveis (1.0.0 → 1.1.0)
npm version minor

# Para MUDANÇAS INCOMPATÍVEIS/BREAKING CHANGES (1.0.0 → 2.0.0)
npm version major
```

**Exemplos:**
- ✅ Corrigiu um bug → `npm version patch`
- ✅ Adicionou uma nova tool do IBGE → `npm version minor`
- ✅ Mudou a API do servidor (quebra compatibilidade) → `npm version major`

### 4️⃣ Publicar no npm

```bash
# Publica a nova versão
npm publish
```

Pronto! A nova versão estará disponível em poucos minutos.

---

## 📋 Processo Completo (Passo a Passo)

### Exemplo: Adicionando uma nova ferramenta

```bash
# 1. Faça as alterações no código
# Edite src/tools/nova-ferramenta.ts

# 2. Teste localmente
npm run build
node dist/index.js

# 3. Commit no git (opcional, mas recomendado)
git add .
git commit -m "feat: adiciona nova ferramenta X"

# 4. Atualize a versão (nova feature = minor)
npm version minor
# Isso irá:
# - Atualizar package.json (1.0.0 → 1.1.0)
# - Criar um git commit automático
# - Criar uma git tag (v1.1.0)

# 5. Publique no npm
npm publish

# 6. Envie para o GitHub (se estiver usando)
git push origin main --tags
```

---

## 🔍 Quando Usar Cada Tipo de Versão

### PATCH (1.0.X)
Correções de bugs que não mudam funcionalidade:
- 🐛 Corrigir erro de formatação
- 🐛 Corrigir validação incorreta
- 🐛 Corrigir retorno de dados errado
- 📝 Atualizar documentação

### MINOR (1.X.0)
Novas funcionalidades compatíveis:
- ✨ Adicionar nova tool do IBGE
- ✨ Adicionar novos parâmetros opcionais
- ✨ Melhorar performance
- ✨ Adicionar cache

### MAJOR (X.0.0)
Mudanças que quebram compatibilidade:
- 💥 Remover tools antigas
- 💥 Renomear parâmetros obrigatórios
- 💥 Mudar estrutura de retorno
- 💥 Mudar comportamento fundamental

---

## 📝 Boas Práticas

### 1. Sempre documente as mudanças

Crie um arquivo `CHANGELOG.md`:

```markdown
# Changelog

## [1.1.0] - 2026-03-10
### Adicionado
- Nova tool `ibge_pib_trimestral` para dados trimestrais do PIB
- Suporte a filtros avançados na tool de população

### Corrigido
- Bug no cálculo de densidade demográfica

## [1.0.0] - 2026-03-10
- Versão inicial
```

### 2. Teste antes de publicar

```bash
# Simule o empacotamento
npm pack --dry-run

# Ou instale localmente para testar
npm pack
npm install -g ./ab-ibge-mcp-server-1.1.0.tgz
```

### 3. Use git tags

```bash
# O npm version já cria a tag automaticamente
# Mas você pode criar manualmente:
git tag -a v1.1.0 -m "Release 1.1.0"
git push origin v1.1.0
```

### 4. Atualize o README

Sempre atualize a documentação com:
- Novas ferramentas adicionadas
- Novos exemplos de uso
- Mudanças importantes

---

## ⚡ Atalho Rápido

### Processo de 1 linha (para melhorias pequenas):

```bash
npm run build && npm version patch && npm publish
```

### Processo completo (recomendado):

```bash
# 1. Build
npm run build

# 2. Teste
node dist/index.js

# 3. Commit
git add .
git commit -m "feat: sua mensagem"

# 4. Versão
npm version minor

# 5. Publica
npm publish

# 6. Push
git push origin main --tags
```

---

## 🔧 Comandos Úteis

```bash
# Ver versão atual
npm version

# Ver informações do pacote publicado
npm view ab-ibge-mcp-server

# Ver todas as versões publicadas
npm view ab-ibge-mcp-server versions

# Despublicar uma versão (cuidado! só funciona em 24h)
npm unpublish ab-ibge-mcp-server@1.0.1

# Depreciar uma versão (melhor que despublicar)
npm deprecate ab-ibge-mcp-server@1.0.1 "Use versão 1.0.2+"
```

---

## ❌ Erros Comuns

### "Cannot publish over existing version"
```bash
# Você esqueceu de incrementar a versão
npm version patch  # Faça isso antes de npm publish
```

### "Git working directory not clean"
```bash
# Commit suas mudanças antes de npm version
git add .
git commit -m "suas mudanças"
npm version patch
```

### "You do not have permission"
```bash
# Verifique se está logado
npm whoami

# Faça login se necessário
npm login
```

---

## 🎯 Checklist Antes de Publicar

- [ ] ✅ Código compilado sem erros (`npm run build`)
- [ ] ✅ Testado localmente (`node dist/index.js`)
- [ ] ✅ README atualizado
- [ ] ✅ CHANGELOG atualizado (se existir)
- [ ] ✅ Versão incrementada (`npm version`)
- [ ] ✅ Git commits feitos
- [ ] ✅ Pronto para publicar (`npm publish`)

---

## 📊 Exemplo Real: Adicionando Tool de PIB Trimestral

```bash
# 1. Crie o arquivo src/tools/pib-trimestral.ts
# 2. Registre no src/index.ts

# 3. Build
npm run build

# 4. Teste
node dist/index.js

# 5. Commit
git add .
git commit -m "feat: adiciona tool ibge_pib_trimestral para dados trimestrais"

# 6. Versão (nova feature = minor)
npm version minor
# Saída: v1.1.0

# 7. Publica
npm publish
# Saída: + ab-ibge-mcp-server@1.1.0

# 8. Push para GitHub
git push origin main --tags

# 9. Usuários podem atualizar
# npm install -g ab-ibge-mcp-server@latest
```

---

## 🌟 Dicas Avançadas

### Publicação Automática com GitHub Actions

Crie `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Agora quando você fizer `git push --tags`, a publicação será automática!