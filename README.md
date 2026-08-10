# Afrika Veracode Build

GitHub Action que prepara aplicações para análise estática na Veracode — do reconhecimento do projeto até um artifact validado e pronto para o fluxo de scan.

## O que é o Afrika Veracode Build?

O **Afrika Veracode Build** é uma GitHub Action criada para automatizar a preparação de aplicações para Static Analysis na Veracode.

Ela identifica o projeto, prepara o build ou o empacotamento e valida se o artifact final está em condições adequadas para seguir para análise.

> A Action **não** executa o Pipeline Scan no uso normal. O Pipeline Scan é usado pela engenharia do produto como **certificação** de que o artifact é aceito pelo motor Veracode.

```text
Repositório
    ↓
Afrika Veracode Build
    ↓
Artifact (.veracode-build/analysisPack.zip)
    ↓
Seu fluxo Veracode (ex.: Pipeline Scan / Upload & Scan)
```

## Qual problema ele resolve?

Preparar um projeto para Static Analysis normalmente exige conhecer linguagem, versão, build system, dependências, estrutura do projeto, formato de artifact e requisitos específicos de packaging.

Configurações erradas podem resultar em:

- scans que não iniciam
- módulos ausentes
- artifacts incompletos
- análise parcial
- configuração manual repetida por projeto

A Action automatiza esse trabalho e reduz o atrito de onboarding SAST.

## Como funciona?

```text
Repositório
    ↓
Discovery
    ↓
Builder
    ↓
Doctor
    ↓
Artifact pronto
```

1. **Discovery** entende como a aplicação está estruturada
2. **Builder** utiliza essas informações para preparar o artifact
3. **Doctor** faz a verificação final e aponta problemas que podem impedir ou prejudicar a análise

Detalhes de arquitetura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Módulos

### Discovery

O Discovery analisa automaticamente o repositório e identifica informações necessárias para a preparação, como:

- linguagem
- runtime
- framework
- build system
- package manager
- estrutura do projeto

### Builder

O Builder utiliza o resultado do Discovery para executar a estratégia adequada de preparação.

Dependendo da tecnologia, isso pode significar compilar, restaurar dependências, publicar ou preparar um pacote de código-fonte.

O resultado é o artifact utilizado no restante do fluxo Veracode.

### Doctor

O Doctor é a última etapa da preparação.

Ele analisa o artifact produzido e verifica requisitos públicos de packaging e qualidade necessários para análise pela Veracode.

Estados possíveis:

- `READY`
- `READY_WITH_WARNINGS`
- `INVALID`

Documentação técnica: [docs/VERACODE-PACKAGING.md](docs/VERACODE-PACKAGING.md) · [docs/BUILDER-DOCTOR-CONTRACT.md](docs/BUILDER-DOCTOR-CONTRACT.md)

## Build Config: reutilização inteligente da configuração

Na primeira execução, a Action precisa descobrir como o projeto deve ser preparado.

Depois que uma configuração válida é encontrada e o Doctor confirma o artifact, essa configuração pode ser armazenada.

Nas próximas execuções, quando o projeto continua compatível com aquela configuração, a Action pode reutilizá-la.

```text
Primeira execução

Discovery → Builder → Doctor → Build Config salvo

Depois

Build Config reutilizado → Builder → Doctor
```

Isso reduz redescoberta desnecessária, tempo de preparação, variações de configuração e trabalho manual.

A configuração pode ser reutilizada **enquanto continuar válida**. Quando a Action identifica que precisa redescobrir o projeto, o Discovery é executado novamente.

### Formato e repositório

- Formato: **JSON** (`build-config.json`)
- Caminho remoto: `<owner>/<repository>/build-config.json`
- Por padrão, a Action utiliza o repositório **Afrika-Veracode-Build-Configs**
- O repositório é **configurável** via input `config_repo`

Detalhes: [docs/CONFIG-SCHEMA.md](docs/CONFIG-SCHEMA.md)

### Segurança

O Build Config **não** armazena credenciais.

Ele pode registrar os **nomes** das variáveis de ambiente necessárias, mas nunca password, token, API key ou private key.

### Exemplo com GitHub App (recomendado)

```yaml
- uses: JuanCunhaa/Afrika-Veracode-Build@<FULL_COMMIT_SHA>
  with:
    config_mode: auto
    config_org: MinhaOrganizacao
    config_github_app_id: ${{ secrets.BUILD_CONFIG_GITHUB_APP_ID }}
    config_github_app_private_key: ${{ secrets.BUILD_CONFIG_GITHUB_APP_PRIVATE_KEY }}
    config_github_app_installation_id: ${{ secrets.BUILD_CONFIG_GITHUB_APP_INSTALLATION_ID }}
```

## Tecnologias e versões suportadas

<!-- SUPPORT_MATRIX:START -->
<!--
Esta seção é gerada automaticamente.
Não editar manualmente.
-->

Matriz referente à última certificação publicada (quando existir).
Cobertura = **100% da matriz de suporte oficialmente declarada** — não “qualquer aplicação do mundo”.

| Tecnologia     | Versão  | Discovery | Builder | Doctor | Veracode | Status       |
| -------------- | ------- | --------: | ------: | -----: | -------: | ------------ |
| Java + Maven   | 8       |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| Java + Maven   | 11      |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| Java + Maven   | 17      |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| Java + Maven   | 21      |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| Java + Maven   | 25      |        🧪 |      🧪 |     🧪 |       ⏳ | Experimental |
| Java + Maven   | 26      |        🧪 |      🧪 |     🧪 |       ⏳ | Experimental |
| Java + Gradle  | 8       |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| Java + Gradle  | 11      |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| Java + Gradle  | 17      |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| Java + Gradle  | 21      |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| Java + Gradle  | 25      |        🧪 |      🧪 |     🧪 |       ⏳ | Experimental |
| Java + Gradle  | 26      |        🧪 |      🧪 |     🧪 |       ⏳ | Experimental |
| JavaScript     | Node 20 |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| JavaScript     | Node 22 |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| TypeScript     | Node 20 |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| TypeScript     | Node 22 |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| .NET           | 6       |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| .NET           | 7       |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| .NET           | 8       |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| .NET           | 9       |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| .NET           | 10      |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| .NET Framework | 4.8     |        🧪 |      🧪 |     🧪 |       ⏳ | Beta         |
| C++/CLI        | —       |        🧪 |      ❌ |     ❌ |       ⏳ | Experimental |
| Xamarin/MAUI   | —       |        🧪 |      ❌ |     ❌ |       ⏳ | Experimental |
| Python         | —       |        ⏳ |      ⏳ |     ⏳ |       ⏳ | Planejado    |

**Legenda**

- ✅ Validado
- 🧪 Em validação / Beta / Experimental
- ⏳ Ainda não certificado
- ❌ Não suportado / não implementado

**Veracode** = validação realizada através do Veracode Pipeline Scan (Static Analysis).
Uma linha só recebe Veracode ✅ quando **todos** os casos de certificação obrigatórios daquela linha passam (ex.: JAR e WAR).
Não inclui SCA, Upload & Scan, Sandbox, DAST ou outros produtos Veracode.

**Builder** inclui preparação/empacotamento de código-fonte (ex.: JavaScript/TypeScript), mesmo quando não há compilação tradicional.

**Como validamos o suporte**

Uma tecnologia só é considerada **Stable** após passar por Discovery, preparação do artifact, Doctor e validação real através do Veracode Pipeline Scan.

Nenhuma release ainda foi certificada com Pipeline Scan real nesta árvore de evidências.

<!-- SUPPORT_MATRIX:END -->

## Como utilizar

### Exemplo mínimo

Prefira **pinning por SHA completo** do commit (não use `@main`).

```yaml
permissions:
  contents: read

jobs:
  prepare:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - uses: JuanCunhaa/Afrika-Veracode-Build@<FULL_COMMIT_SHA>
        with:
          source: .
```

### Saída principal

A principal saída é:

```text
.veracode-build/analysisPack.zip
```

Esse artifact pode ser utilizado no restante do fluxo Veracode.

Outros outputs úteis incluem `doctor_status`, `artifact_path`, `language`, `runtime_version` e `config_status`. Lista completa em `action.yml`.

### Registries privados

Exponha tokens via `env:` do job — nunca em inputs de comando:

```yaml
env:
  NUGET_TOKEN: ${{ secrets.NUGET_TOKEN }}
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
  MAVEN_USERNAME: ${{ secrets.MAVEN_USERNAME }}
  MAVEN_PASSWORD: ${{ secrets.MAVEN_PASSWORD }}
```

## Integração no fluxo Veracode

O Afrika Veracode Build termina no artifact validado pelo Doctor.

A etapa seguinte (Pipeline Scan, Upload & Scan, gates de política, etc.) permanece no seu pipeline — por exemplo via [Veracode-Connect](https://github.com/Afrika-Tecnologia/Veracode-Connect) ou integração equivalente.

A certificação interna do produto (Pipeline Scan E2E) valida que as tecnologias **Stable** realmente produzem artifacts aceitos pelo motor Veracode. Isso é garantia de qualidade do produto, não uma etapa do uso diário da Action.

## Documentação adicional

| Documento                                                  | Conteúdo                           |
| ---------------------------------------------------------- | ---------------------------------- |
| [ARCHITECTURE](docs/ARCHITECTURE.md)                       | Arquitetura interna                |
| [CONFIG-SCHEMA](docs/CONFIG-SCHEMA.md)                     | Schema do Build Config             |
| [FEATURE-COMPLETENESS](docs/FEATURE-COMPLETENESS.md)       | Contrato de completude de features |
| [TEST-LAB](docs/TEST-LAB.md)                               | Laboratório de qualidade           |
| [VERACODE-PACKAGING](docs/VERACODE-PACKAGING.md)           | Requisitos públicos de packaging   |
| [BUILDER-DOCTOR-CONTRACT](docs/BUILDER-DOCTOR-CONTRACT.md) | Contrato Builder → Doctor          |
| [TROUBLESHOOTING](docs/TROUBLESHOOTING.md)                 | Resolução de problemas             |

## Desenvolvimento e créditos

Desenvolvido por **Juan Cunha**

- E-mail: juan.cunha@afrikatec.com.br
- GitHub: [JuanCunhaa](https://github.com/JuanCunhaa)

Para contribuir com o código da Action, consulte [CONTRIBUTING.md](CONTRIBUTING.md) e [SECURITY.md](SECURITY.md).

Gates de qualidade do produto:

- **Local Gate** — testes e políticas no repositório da Action
- **Lab Compatibility Gate** — compatibilidade com aplicações reais
- **Product Quality Gate** / **Product Main Gate** — visão consolidada por evento
- **Release Certification Gate** — elegibilidade de release (Lab full + Pipeline Scan full)

## Licença

Software proprietário. Todos os direitos reservados © Juan Cunha / Afrika Tecnologia.

Uso, cópia, modificação e distribuição somente com autorização expressa.
