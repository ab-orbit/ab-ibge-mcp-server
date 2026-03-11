# 📦 Guia de Publicação no npm

## Preparação Concluída ✅

O projeto já está configurado para publicação com:
- ✅ Nome único: `ab-ibge-mcp-server`
- ✅ Arquivo LICENSE (MIT)
- ✅ .npmignore configurado
- ✅ package.json com todas as informações necessárias
- ✅ Script bin para instalação global
- ✅ Build compilado e testado
- ✅ README atualizado com instruções de instalação via npm

## Passos para Publicar

### 1. Verificar login no npm

```bash
npm whoami
```

Se não estiver logado, faça login:

```bash
npm login
```

### 2. (Opcional) Verificar se o nome está disponível

```bash
npm search ab-ibge-mcp-server
```

Se o nome já estiver em uso, você precisará escolher outro nome no `package.json`.

### 3. Publicar o pacote

```bash
npm publish --access public
```

**Nota:** O flag `--access public` é necessário na primeira publicação para pacotes com escopo `@` ou para garantir que seja público.

### 4. Verificar a publicação

Após alguns minutos, verifique em: https://www.npmjs.com/package/ab-ibge-mcp-server

### 5. Testar a instalação global

Em outra pasta, teste:

```bash
npm install -g ab-ibge-mcp-server
ab-ibge-mcp-server --help
```

## Atualizações Futuras

### Para publicar uma nova versão:

1. Atualize a versão no `package.json`:
   ```bash
   npm version patch  # Para correções: 1.0.0 → 1.0.1
   npm version minor  # Para novas features: 1.0.0 → 1.1.0
   npm version major  # Para breaking changes: 1.0.0 → 2.0.0
   ```

2. Publique novamente:
   ```bash
   npm publish
   ```

## Dicas

- **Sempre teste localmente** antes de publicar com `npm pack --dry-run`
- **Use semantic versioning**: major.minor.patch
- **Mantenha o README atualizado** com exemplos de uso
- **Adicione um CHANGELOG.md** para documentar mudanças entre versões
- **Configure GitHub Actions** para publicação automática (opcional)

## Troubleshooting

### Erro: "You do not have permission to publish"
- Verifique se está logado: `npm whoami`
- Verifique se o nome do pacote já existe

### Erro: "Package name too similar"
- O npm pode rejeitar nomes muito similares a pacotes existentes
- Escolha um nome mais único

### Erro: "Cannot publish over existing version"
- Você esqueceu de incrementar a versão no package.json
- Use `npm version patch/minor/major` antes de publicar

## Links Úteis

- [npm Documentation](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [npm Package Best Practices](https://docs.npmjs.com/packages-and-modules)