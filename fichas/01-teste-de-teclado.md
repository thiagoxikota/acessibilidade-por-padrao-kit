# Ficha 1. Teste de teclado (e leitor de tela em 5 minutos)

**Tempo, por tarefa:** uns 5 minutos de teclado, 2 de zoom só no texto e 5 de leitor de tela. Se só der tempo de um, faça o teclado. **Quem faz:** qualquer pessoa do time, inclusive quem faz o design.

## Antes de começar, no Mac

No Safari, o Tab pula links até você mudar duas opções. Sem elas, parece falha do site:

1. No Safari: Ajustes, Avançado, marque a opção de usar o Tab para destacar cada item da página ([Apple](https://support.apple.com/guide/safari/advanced-ibrw1075/mac)).
2. Em Ajustes do Sistema, Teclado, ligue a navegação pelo teclado. É ela que deixa o Tab chegar em todos os itens que recebem foco ([W3C](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)).

Se o Tab pular links ou botões em qualquer navegador do Mac, confira o item 2 antes de anotar a falha.

## Como fazer

1. Escolha uma tarefa real da página. Exemplo: comprar um ingresso, enviar um formulário.
2. Tire a mão do mouse.
3. Faça a tarefa só com o teclado:

| Tecla | Para quê |
|---|---|
| **Tab** | Vai para o próximo item clicável |
| **Shift + Tab** | Volta |
| **Enter** | Ativa link e botão |
| **Espaço** | Ativa botão, marca caixa |
| **Esc** | Fecha menu, janela e aviso. O foco deve voltar para o botão que abriu |
| **Setas** | Andam **dentro** de menus, abas, listas e botões de opção. O Tab entra e sai do componente; as setas andam por dentro ([padrão da W3C](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)) |

4. Grave a tela enquanto testa. Print não mostra foco nem ordem.

## O que observar

| Pergunta | Se a resposta for não |
|---|---|
| Chego em tudo o que dá para clicar? | Item fora do alcance do teclado. Anote qual. |
| Consigo sair de cada lugar? | Foco preso. Exceção: numa janela aberta, o foco fica dentro de propósito até o Esc. |
| Vejo sempre onde o foco está? | Foco invisível ([WCAG 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)). **O axe não verifica isso, e a trava deste kit também não.** |
| O foco fica à vista, sem sumir atrás de cabeçalho fixo ou aviso de cookies? | Foco encoberto ([WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)). |
| A ordem faz sentido para a tarefa? | Ordem confusa ([WCAG 2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)). Não precisa ser idêntica à leitura visual, mas precisa preservar o sentido. |
| O foco fica onde eu deixei? | Foco que pula sozinho. Anote em qual Tab. |
| Consigo terminar a tarefa? | A tarefa some para quem depende do teclado. É o mais grave. |

**Regra de bolso:** se o foco some, a tarefa some.

## Ampliar só o texto (2 minutos)

Amplie só o texto até 200% e refaça a tarefa ([W3C Easy Checks](https://www.w3.org/WAI/test-evaluate/preliminary/)):

- **Firefox:** no menu Exibir, Zoom, marque a opção de zoom só no texto (em inglês: View, Zoom, Zoom Text Only). Depois, Cmd ou Ctrl e "+". De quatro a seis toques costumam chegar a 200%.
- **Safari:** Option + Cmd + "+".

Procure texto cortado, texto em cima de texto e botão que some ([WCAG 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)).

## Leitor de tela em 5 minutos

Não é teste completo. É para ouvir se os nomes fazem sentido.

**VoiceOver, no Mac** ([Apple](https://support.apple.com/guide/voiceover/turn-voiceover-on-or-off-vo2682/mac)):

| Tecla | Para quê |
|---|---|
| **Cmd + F5** | Liga e desliga |
| **Control + Option** (a tecla "VO") | Prefixo dos comandos |
| **VO + seta para a direita** | Próximo item |
| **VO + U** | Lista de títulos, links e campos da página |
| **Control** | Cala a fala |

**NVDA, no Windows, gratuito** ([guia do NVDA](https://download.nvaccess.org/documentation/userGuide.html)):

| Tecla | Para quê |
|---|---|
| **Insert** (a tecla "NVDA") | Prefixo dos comandos |
| **H, D, K, F, B** | Próximo título, região, link, campo, botão |
| **Control** | Cala a fala |
| **NVDA + Espaço** | Alterna entre navegar e preencher |
| **NVDA + Q** | Sai |

**O que ouvir:** cada botão diz o que faz? Cada campo diz o próprio nome? Lista é anunciada como lista? Aberto, fechado e marcado são anunciados?

Para um teste formal, o governo britânico lista as combinações mínimas de leitor e navegador ([GOV.UK](https://www.gov.uk/service-manual/technology/testing-with-assistive-technologies)).

## Ferramenta grátis que ajuda

**Accessibility Insights for Web**, da Microsoft: o modo FastPass roda o teste automático e desenha o caminho do Tab em cima da página, em menos de cinco minutos ([FastPass](https://accessibilityinsights.io/docs/web/getstarted/fastpass/)).

## Registro

| Página | Tarefa | Tab em que falhou | O que aconteceu | Gravação |
|---|---|---|---|---|
| | | | | |

## Fontes

- W3C, [Easy Checks](https://www.w3.org/WAI/test-evaluate/preliminary/) e [padrões de teclado (APG)](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- Microsoft, [Accessibility Insights FastPass](https://accessibilityinsights.io/docs/web/getstarted/fastpass/)
- WebAIM, [VoiceOver](https://webaim.org/articles/voiceover/) e [NVDA](https://webaim.org/articles/nvda/)
