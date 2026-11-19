# Trava de acessibilidade

Teste automático para rodar a cada mudança, no GitHub ou em outro CI. Ele trava só o que é **novo e grave**. O que já existia vira tarefa com dono e prazo. Exceção precisa de motivo, de quem aprovou e de validade. O que a máquina não consegue julgar vai para uma lista de revisão à mão, com capturas de tela.

As regras vêm da [ficha 4](../fichas/04-trava-preenchida.md). O caso real que inspirou cada regra está em [exemplos/menu-dsgov.md](../exemplos/menu-dsgov.md).

## Antes de tudo: o que ela não faz

- **Não diz que o site é acessível.** Teste automático acha só parte dos problemas. O fabricante do axe calcula 57% dos problemas, contados por quantidade, numa amostra de mais de 13 mil páginas ([Deque, 2021](https://www.deque.com/automated-accessibility-testing-coverage/)). No teste do governo britânico, com 142 barreiras plantadas numa página, o axe achou 29% e a melhor ferramenta, 40% ([GOV.UK, 2018](https://alphagov.github.io/accessibility-tool-audit/)). As ferramentas mudaram desde então; o método continua valendo. Teclado, leitor de tela e teste com gente continuam ([ficha 1](../fichas/01-teste-de-teclado.md)).
- **Não testa interação sozinha.** Ela olha a página como abre. Para menu aberto, modal ou erro de formulário, descreva o caminho num [roteiro](#5-teste-estados-com-um-roteiro).
- **Não bloqueia deploy sozinha.** Ela só falha o job. Para a mudança "não ir pro ar", o check precisa ser obrigatório na branch e o deploy precisa depender dele (veja [Ligue no CI](#6-ligue-no-ci)).

## O que ela pega e o que não pega

Cada linha é uma página com a barreira plantada de propósito, em `teste/paginas/`, e um teste que exige o resultado da tabela. Inclusive os limites: se um dia a trava passar a pegar foco invisível, o teste avisa.

| Barreira plantada | Resultado | Por quê |
|---|---|---|
| Imagem sem texto alternativo | **Trava** | axe `image-alt`, impacto crítico |
| Botão sem nome | **Trava** | axe `button-name`, impacto crítico |
| Contraste baixo | **Trava** | axe `color-contrast`, impacto sério |
| Zoom bloqueado (`user-scalable=no`) | **Trava** | axe `meta-viewport` é moderado, mas está em `SEMPRE_TRAVA` |
| Botão sem nome dentro de menu fechado | Passa | Escondido, o axe não olha |
| O mesmo menu, aberto por um roteiro | **Trava** | O roteiro clica e espera o menu aparecer |
| Página que rola para o lado em 320 px | Revisar à mão | Sinal geométrico, WCAG 1.4.10 |
| Texto cortado com o texto em 200%, inclusive texto em px e texto dentro de outro elemento | Revisar à mão | Sinal geométrico, WCAG 1.4.4. Caixa que já cortava sem ampliar não conta |
| Foco invisível (`outline: none`) | **Passa: limite conhecido** | Nenhuma regra do axe cobre o critério 2.4.7. Faça o [teste de teclado](../fichas/01-teste-de-teclado.md) |
| Ordem de foco sem sentido | **Passa: limite conhecido** | Idem |

O método vem da auditoria de ferramentas do governo britânico: plante a barreira e confira o que cada ferramenta pega, para nenhuma delas ficar verde em silêncio.

## O que ela faz

1. Abre cada rota do site num Chromium, com tela de celular (ou de computador, se você pedir).
2. Se houver roteiro, clica, preenche e espera até a tela chegar no estado pedido. No modo `texto-200`, o roteiro já roda com o texto ampliado.
3. Roda o [axe-core](https://github.com/dequelabs/axe-core) com as regras WCAG 2.0, 2.1 e 2.2, níveis A e AA, em até quatro modos:

| Modo | O que simula | O que mede |
|---|---|---|
| `normal` | A página como abre | Regras do axe |
| `cores-forcadas` | Alto contraste do sistema (`forced-colors: active`) | Regras do axe e captura de tela. Nesse modo, sombra some ([CSS Color Adjustment](https://www.w3.org/TR/css-color-adjust-1/)): foco desenhado só com `box-shadow` desaparece. Olhe a captura |
| `texto-200` | Zoom só no texto: cada elemento com o dobro do tamanho de fonte que tinha, inclusive em px | Regras do axe e **texto cortado** que a ampliação causou ([WCAG 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)) |
| `largura-320` | Tela de 320 px, o mesmo que 1280 px com zoom de 400% | Regras do axe e **rolagem horizontal** ([WCAG 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)) |

4. Guarda os resultados que o axe marcou como "não consegui decidir" (`incomplete`) na lista de revisão à mão, em vez de descartar.
5. Compara tudo com a linha de base e as exceções.

| Situação | Resultado |
|---|---|
| Problema novo de impacto `critical` ou `serious`, ou de uma regra em `SEMPRE_TRAVA` | **Trava** (código 1) |
| Problema da linha de base que piorou de impacto | **Trava** |
| Problema da linha de base que apareceu numa tela ou num modo onde não estava | **Trava**. Se a base foi gerada sem essa tela ou modo, gere de novo |
| Exceção vencida, mesmo para item da linha de base | **Trava** |
| Exceção sem `motivo`, `aprovado_por` ou `validade`, com data impossível ou com rota sem `/` no começo | **Trava** |
| Problema que já estava na linha de base | Passa, e aparece na contagem |
| Problema da linha de base com seletor novo, mas na mesma posição da página | Passa, conta como já existia e avisa para gerar a base de novo |
| Linha de base sem dono, sem prazo ou com prazo vencido | Passa com aviso. Com `ESTRITO=1`, trava |
| Problema coberto por exceção dentro da validade | Passa, e mostra quem aprovou e até quando |
| Problema novo de impacto `moderate` ou `minor` | Passa, como aviso |
| Exceção que não cobre mais nada | Passa, e avisa que pode sair do arquivo |
| Item da linha de base que sumiu de toda tela e modo onde aparecia, com a mesma regra rodando e resposta clara do axe | Passa, e avisa que foi resolvido |
| Item que sumiu, mas não foi procurado de novo em todo lugar, ou que o axe não conseguiu decidir | Continua na linha de base |
| Texto cortado, rolagem horizontal, regra que o axe não decidiu | Passa, na lista **Para revisar à mão** |
| Configuração errada, etiqueta de regra que não existe, nada para testar, site fora do ar, JSON quebrado, roteiro que não acha o botão ou que não termina em `esperar` | Erro (código 2). Nunca vira verde |

### Por que `critical` e `serious`, e por que o zoom trava sempre

O axe classifica cada falha por impacto: `minor`, `moderate`, `serious` e `critical` ([descrição das regras](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)). Ele chama de `serious` falhas como **contraste baixo**, **link sem nome** e **alvo de toque pequeno**. No estudo que deu origem a este kit, contraste foi a falha mais frequente. Travar só `critical` deixaria passar justamente ela.

**Zoom bloqueado** é `moderate` no axe, mas impede quem tem baixa visão de ampliar a página. Por isso fica em `SEMPRE_TRAVA`.

Impacto do axe e nível da WCAG são coisas diferentes: o impacto diz quanto atrapalha quem usa; o nível (A, AA) diz o que a norma exige.

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

Isso grava `linha-de-base.json` com o que já existe hoje. Preencha `dono` e `prazo` de cada item e faça commit do arquivo. É uma lista de tarefas, não um tapete para esconder problema.

Rodar de novo **preserva** dono, prazo e nota de quem já tinha, e as telas e modos que não rodaram desta vez. Itens novos entram com `[definir]`.

Cada item é reconhecido pela rota, pela regra e pelo seletor que o axe dá ao elemento. Esse seletor pode usar atributos e muda quando um atributo sai: no [menu do DSGov](../exemplos/menu-dsgov.md), tirar `role="treeitem"` mudou o seletor de 21 links que continuavam com alvo de toque pequeno. Por isso cada item guarda também a posição do elemento na página (`xpath`). Basta um dos dois bater para ser o mesmo item. A trava avisa quando reconheceu pela posição, e o relatório mostra o seletor antigo em `seletor_na_base`; gerar a linha de base de novo atualiza o seletor e mantém dono e prazo.

### 2. Rode a trava

```sh
BASE_URL=http://localhost:4321 ROTAS=/,/contato npm run trava
```

Saída real, com `ROTAS=/com-falha.html`, uma página de teste com dois problemas graves:

```text
Trava de acessibilidade: 1 rota(s), 0 estado(s) de roteiro, 4 execucao(oes), modos normal, cores-forcadas, texto-200, largura-320, telas celular.
Trava em: impacto critical, serious, e sempre em meta-viewport. Regras: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa.
Ja existiam (na linha de base): 0.
Capturas de tela: 4, em trava-capturas/.

TRAVOU: 2 problema(s).
Novo e grave:
  /com-falha.html  button-name  #fechar  (critical; em celular/normal, celular/cores-forcadas, celular/texto-200, 320px/largura-320)
    Buttons must have discernible text
    https://dequeuniversity.com/rules/axe/4.11/button-name?application=playwright
Novo e grave:
  /com-falha.html  image-alt  #foto  (critical; em celular/normal, celular/cores-forcadas, celular/texto-200, 320px/largura-320)
    Images must have alternative text
    https://dequeuniversity.com/rules/axe/4.11/image-alt?application=playwright

Relatorio completo em trava-relatorio.json.
```

### 3. Quando consertar, limpe a linha de base

```sh
BASE_URL=http://localhost:4321 ROTAS=/,/contato npm run limpar-resolvidos
```

Tira só o que foi procurado de novo em cada tela e modo onde aparecia, com a mesma regra rodando, e não apareceu. Se o axe não conseguiu decidir, o item fica. Não adiciona nada. Se o problema voltar depois, ele volta como **novo** e trava.

### 4. Registre exceções, se precisar

Copie `excecoes.exemplo.json` para `excecoes.json`. Cada exceção cobre uma regra num seletor (e, se quiser, numa rota e num estado do roteiro):

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

A exceção vale para o seletor escrito nela, o mesmo que a trava mostra na saída. Diferente da linha de base, ela não reconhece o elemento pela posição: se o seletor mudar, ela deixa de cobrir e aparece como sem uso, e o problema é tratado como se ela não existisse (trava, se não estiver na linha de base). Atualize o seletor; quem aprovou decide se a exceção continua.

### 5. Teste estados com um roteiro

Menu aberto, modal e erro de formulário só existem depois de uma ação. Descreva o caminho em `roteiro.json` (veja `roteiro.exemplo.json`) e passe `ROTEIRO=roteiro.json`:

```json
{
  "rota": "/",
  "estado": "menu aberto",
  "acoes": [
    { "clicar": "#abrir-menu" },
    { "esperar": "#menu" }
  ]
}
```

Ações: `clicar` (seletor), `esperar` (seletor visível), `teclar` (tecla, como `Tab` ou `Escape`) e `preencher` (seletor, com `texto`). A ideia vem das `actions` do [pa11y-ci](https://github.com/pa11y/pa11y-ci).

**Termine sempre com `esperar`**, num elemento que só existe no estado pedido: o menu aberto, a mensagem de erro. Sem isso, um clique que não fez nada passaria despercebido e a trava olharia a tela errada. Se uma ação falhar, a trava dá erro de configuração em vez de testar a tela errada.

### 6. Ligue no CI

`exemplo-workflow.yml` mostra um job do GitHub Actions: sobe o site, roda a trava, escreve o resumo na página do job e guarda o relatório e as capturas.

Para a trava valer de verdade:

1. **Torne o check obrigatório.** No GitHub: Settings, Rules (ou Branches), regra da `main`, "Require status checks to pass", e escolha o job `trava`.
2. **Faça o deploy depender dele.** Se o deploy roda no mesmo workflow, use `needs: trava`. Se roda em outro serviço, deixe o deploy só a partir da `main` protegida.

## Variáveis

| Variável | Padrão | Para quê |
|---|---|---|
| `BASE_URL` | obrigatória | Endereço do site, com `http://` ou `https://`. Pode ter subpasta: `https://exemplo.github.io/projeto/` mais a rota `/contato` testa `/projeto/contato` |
| `ROTAS` | `/` (vazio se houver `ROTEIRO`) | Rotas separadas por vírgula |
| `ROTEIRO` | nenhum | Arquivo com estados que exigem interação |
| `MODOS` | `normal,cores-forcadas,texto-200,largura-320` | Quais modos rodar |
| `TELAS` | `celular` | `celular` (390 px), `computador` (1280 px) ou os dois |
| `IMPACTO` | `critical,serious` | Impactos que travam: `critical`, `serious`, `moderate`, `minor` |
| `SEMPRE_TRAVA` | `meta-viewport` | Regras do axe que travam qualquer que seja o impacto |
| `REGRAS` | `wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa` | Tags do axe. Some `best-practice` para incluir boas práticas. Tag que o axe não conhece dá erro; lista que não roda nenhuma regra também. No axe 4.11, `wcag21a` só tem uma regra experimental, que não roda: o critério dela (2.5.3, nome visível dentro do nome acessível) fica para o teste à mão |
| `ESPERA` | `load` | Quando a página está pronta: `load`, `domcontentloaded` ou `networkidle` |
| `ESTRITO` | desligado | `1` faz a linha de base sem dono ou com prazo vencido travar. Confere o arquivo inteiro, não só as rotas desta execução: quando um prazo vence, toda mudança trava até alguém renovar o prazo ou consertar |
| `LINHA_DE_BASE` | `linha-de-base.json` | Arquivo da linha de base |
| `EXCECOES` | `excecoes.json` | Arquivo de exceções |
| `RELATORIO` | `trava-relatorio.json` | Relatório completo em JSON |
| `CAPTURAS` | `trava-capturas` | Pasta das capturas de tela. `0` desliga |
| `HOJE` | data local | Data usada para checar validade e prazo. Defina `TZ=America/Sao_Paulo` no CI |

**Comece pequeno.** Uma rota, um tipo de falha, uma pessoa responsável. Teste que demora é teste que o time desliga.

## Limites que você precisa saber

- **A linha de base reconhece cada problema pelo seletor do axe ou pela posição do elemento na página (`xpath`)**, e anota em que telas e modos ele aparece. Se os dois mudam na mesma mudança (um id renomeado, ou o elemento muda de classe e de lugar), o problema antigo aparece como novo e trava; gerar a base de novo não leva o dono e o prazo para ele. O contrário também acontece: um elemento novo, com o mesmo problema, exatamente no lugar de um antigo que saiu, conta como o antigo. A trava avisa sempre que reconhece um item pela posição. Prefira ids estáveis nos componentes.
- **`texto-200` imita o zoom só no texto do Firefox, mas não é ele.** Dobra o tamanho de fonte de cada elemento, inclusive em px, e não entra em iframe nem em shadow DOM fechado. A verificação de verdade continua sendo ampliar só o texto no navegador e olhar ([ficha 1](../fichas/01-teste-de-teclado.md)).
- **`cores-forcadas` depende da captura.** O axe mede a página, mas ícone que some e foco que desaparece só aparecem na imagem.
- **Roda no Chromium.** A emulação de cores forçadas não foi conferida em Firefox e WebKit.

## Quando usar outra ferramenta

| Você quer | Use |
|---|---|
| Testar acessibilidade dentro dos testes que o time já tem | [axe com Playwright Test](https://playwright.dev/docs/accessibility-testing) |
| Rodar muitas páginas a partir de um sitemap | [pa11y-ci](https://github.com/pa11y/pa11y-ci) |
| Acessibilidade junto com desempenho e SEO | [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci). Trave por auditoria, não pela nota: a nota de acessibilidade é uma média que [deixa de fora os testes manuais](https://developer.chrome.com/docs/lighthouse/accessibility/scoring) |
| Ouvir o exemplo num leitor de tela, de forma automática | [Guidepup](https://github.com/guidepup/guidepup) (não testado com este kit) |
| Linha de base com dono e prazo, exceção com validade, revisão à mão com capturas | Esta trava |

## Teste da própria trava

```sh
npm test
```

Sobe páginas locais com barreiras plantadas e confere 55 casos: o básico, contraste, zoom bloqueado, os dois limites conhecidos (foco invisível e ordem de foco), roteiro de menu aberto (também com o texto ampliado), linha de base (gerar, preservar dono e telas, prazo vencido, dono em branco, modo estrito), conserto e regressão, conserto que muda o seletor (o padrão do menu do DSGov), "resolvido" só com reteste completo, problema conhecido que aparece em tela ou modo novo, exceções (válida, vencida, incompleta, data impossível, rota sem barra, sem uso), revisão à mão (rolagem e texto cortado), capturas, resumo do GitHub, endereço com subpasta e erros de configuração que nunca podem virar verde (inclusive tag que o axe não conhece e lista de tags que não roda nenhuma regra).
