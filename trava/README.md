# Trava de acessibilidade

Teste automático para rodar a cada mudança, no GitHub ou em outro CI. Ele trava só o que é **novo e grave**. O que já existia vira tarefa com dono e prazo. Exceção precisa de quem aprovou, motivo e validade.

As regras vêm da [ficha 4](../fichas/04-trava-preenchida.md).

## O que ela faz

1. Abre cada rota do site num Chromium com tela de celular.
2. Roda o [axe-core](https://github.com/dequelabs/axe-core) (regras WCAG 2.0, 2.1 e 2.2, níveis A e AA) em três modos:
   - `normal`;
   - `cores-forcadas`: alto contraste do sistema;
   - `texto-200`: fonte base dobrada, uma aproximação do texto ampliado a 200%.
3. Compara o que achou com a linha de base e as exceções.

| Situação | Resultado |
|---|---|
| Problema novo de impacto crítico | **Trava** (sai com código 1) |
| Problema que já estava na linha de base | Passa, e aparece na contagem |
| Problema coberto por exceção dentro da validade | Passa, e aparece com quem aprovou |
| Exceção vencida | **Trava** |
| Exceção sem `motivo`, `aprovado_por` ou `validade` | **Trava** |
| Problema novo abaixo do impacto que trava | Passa, como aviso |
| Item da linha de base que não aparece mais | Passa, e avisa que pode sair da base |
| Site fora do ar ou configuração errada | Erro (código 2) |

Verde quer dizer: a máquina não achou erro novo. Teste automático não pega tudo. Ordem de foco, texto e uso real dependem de teste com gente ([ficha 1](../fichas/01-teste-de-teclado.md)).

## Como usar

Precisa de Node 20 ou mais novo.

```sh
cd trava
npm install
npx playwright install chromium
```

### 1. Gere a linha de base

Com o site rodando:

```sh
BASE_URL=http://localhost:4321 ROTAS=/,/contato npm run linha-de-base
```

Isso grava `linha-de-base.json` com tudo o que já existe hoje. Preencha `dono` e `prazo` de cada item e faça commit do arquivo. É uma lista de tarefas, não um tapete para esconder problema.

### 2. Rode a trava

```sh
BASE_URL=http://localhost:4321 ROTAS=/,/contato npm run trava
```

### 3. Registre exceções, se precisar

Copie `excecoes.exemplo.json` para `excecoes.json`. Cada exceção cobre uma regra num seletor (e, se quiser, numa rota):

```json
{
  "rota": "/",
  "regra": "image-alt",
  "seletor": "#banner-campanha",
  "motivo": "Banner antigo sai do ar na troca de campanha.",
  "aprovado_por": "Nome de quem aprovou",
  "validade": "2026-12-31"
}
```

### 4. Ligue no CI

`exemplo-workflow.yml` mostra um job do GitHub Actions. Ajuste o passo que sobe o seu site.

## Variáveis

| Variável | Padrão | Para quê |
|---|---|---|
| `BASE_URL` | obrigatória | Endereço do site |
| `ROTAS` | `/` | Rotas separadas por vírgula |
| `MODOS` | `normal,cores-forcadas,texto-200` | Quais modos rodar |
| `IMPACTO` | `critical` | Impactos que travam. Ex.: `critical,serious` |
| `LINHA_DE_BASE` | `linha-de-base.json` | Arquivo da linha de base |
| `EXCECOES` | `excecoes.json` | Arquivo de exceções |
| `RELATORIO` | `trava-relatorio.json` | Relatório completo em JSON |
| `HOJE` | data atual | Data usada para checar validade (útil em teste) |

**Comece pequeno.** Uma rota, um tipo de falha, uma pessoa responsável. Teste que demora é teste que o time desliga.

## Teste da própria trava

```sh
npm test
```

Sobe duas páginas locais (uma limpa, uma com falhas conhecidas) e confere oito casos: página limpa passa, falha nova trava, linha de base gerada e respeitada, exceção válida libera, exceção vencida trava, exceção incompleta trava e configuração faltando dá erro.
