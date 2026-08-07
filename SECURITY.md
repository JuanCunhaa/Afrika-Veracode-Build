# Security Policy

## Reporting a Vulnerability

Nao abra issues publicas com detalhes de vulnerabilidades sensiveis.

Reporte vulnerabilidades de forma privada para:

`SECURITY_CONTACT_EMAIL_PLACEHOLDER`

Substitua este placeholder pelo canal oficial de security da Afrika Tecnologia antes do uso em producao.

Inclua:

- descricao do problema;
- impacto potencial;
- passos para reproduzir (quando seguro);
- versao/tag/SHA afetado.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | yes       |

## Secret Handling

- Nunca envie tokens, private keys, PATs ou senhas como inputs comuns de workflow.
- Prefira `env:` com secrets do GitHub Actions.
- A Action mascara valores sensiveis com `::add-mask::` quando necessario.
- Build Config remoto armazena apenas **nomes** de variaveis de ambiente, nunca valores.
- Arquivos temporarios com credenciais usam permissao restrita e sao removidos em cleanup.

## Dependency and Supply-Chain Policy

- Actions externas devem ser pinadas por SHA completo de 40 caracteres do repositorio original.
- Nao use `@main`, `@master` ou `@latest` para dependencias de Actions.
- Nao use `curl | bash` para instalar ferramentas.
- Prefira versoes fixas e checksums quando disponiveis.
- Dependencias npm de desenvolvimento devem ser versionadas de forma explicita.

## Workflow Least Privilege

Consumidores tipicos precisam apenas:

```yaml
permissions:
  contents: read
```

Acesso ao repositorio central de Build Config deve usar GitHub App dedicado com:

- Contents: Read and write
- Metadata: Read-only

somente no repositorio de configs.
