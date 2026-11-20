# Fontes

Cada número, limite e atalho do kit tem fonte pública. Esta lista diz o que cada fonte sustenta e onde ela aparece. Links e trechos conferidos em 19/11/2026.

## A norma e os padrões da W3C

| Fonte | O que sustenta | Onde |
|---|---|---|
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | A norma. Níveis A e AA | Fichas 2 e 4, trava |
| [1.4.3 Contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | 4,5:1 para texto; 3:1 para texto grande (18 pt, ou 14 pt em negrito: cerca de 24 px e 18,5 px); não arredondar; exceções para componente inativo e logotipo | Ficha 2 |
| [1.4.4 Redimensionar texto](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) | Texto a 200% sem perder conteúdo nem função | Fichas 1 e 2, modo `texto-200` |
| [1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | 320 px de largura, o mesmo que 1280 px com zoom de 400% | Ficha 2, modo `largura-320` |
| [1.4.11 Contraste de não texto](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | 3:1 para partes de componentes, estados e gráficos que informam | Ficha 2 |
| [2.4.3 Ordem do foco](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | A ordem do foco preserva sentido e operação | Ficha 1 |
| [2.4.7 Foco visível](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) | O foco do teclado aparece | Fichas 1 e 2 |
| [2.4.11 Foco não encoberto (mínimo)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | O item com foco não fica todo escondido, nível AA | Ficha 1 |
| [2.5.8 Tamanho do alvo (mínimo)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 24 por 24 px, ou espaço que complete isso, nível AA. Os 44 por 44 px são do critério 2.5.5, nível AAA | Ficha 2 |
| [APG, interface de teclado](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Tab e Shift + Tab andam entre componentes; as setas andam dentro deles. No macOS, um ajuste do sistema deixa o Tab chegar em todos os itens | Fichas 1 e 2 |
| [APG, padrões](https://www.w3.org/WAI/ARIA/apg/patterns/) | Teclas e papéis esperados de menu, abas, janela e acordeão | Ficha 2 |
| [Easy Checks](https://www.w3.org/WAI/test-evaluate/preliminary/) | Checagens "rápidas e fáceis, não definitivas"; caminho do zoom só no texto no Firefox e no Safari; de quatro a seis toques até 200% | Ficha 1 e README |
| [ARRM (rascunho)](https://www.w3.org/WAI/planning/arrm/) | Responsabilidade principal, de apoio e de consulta para cada tarefa de acessibilidade | Ficha 4 |
| [CSS Color Adjustment](https://www.w3.org/TR/css-color-adjust-1/) | Em cores forçadas, `box-shadow` e `text-shadow` viram nada | Ficha 2, modo `cores-forcadas` |

## Governo britânico

| Fonte | O que sustenta | Onde |
|---|---|---|
| [Blog de acessibilidade do GOV.UK, 2017](https://accessibility.blog.gov.uk/2017/02/24/what-we-found-when-we-tested-tools-on-the-worlds-least-accessible-webpage/) | 143 barreiras e dez ferramentas. Juntas, 71%. 42 barreiras (29%) não achadas por nenhuma. A melhor, 41%, contando os pedidos de conferência à mão; só com erros e avisos, 37%. A pior, 17% | Ficha 5 |
| [Auditoria de ferramentas, atualizada em 13/04/2018](https://alphagov.github.io/accessibility-tool-audit/) | 142 barreiras e 13 ferramentas. Detectadas por inteiro: a melhor, 40%; o axe, 29%. O método de plantar barreiras | README da trava, teste da trava |
| [Manual de serviços: testar acessibilidade](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility) | Teste desde o código de produção; auditoria antes da beta pública; teste a cada funcionalidade nova depois disso; automático e à mão | Ficha 5 |
| [Manual de serviços: testar com tecnologias assistivas](https://www.gov.uk/service-manual/technology/testing-with-assistive-technologies) | Combinações de leitor de tela e navegador para um teste formal | Ficha 1 |
| [Critérios de aceite de acessibilidade dos componentes](https://docs.publishing.service.gov.uk/repos/govuk_publishing_components/accessibility_acceptance_criteria.html) | Critério específico e testável; o exemplo do banner com 4,5:1; cada falha encontrada vira critério, como um teste que falha | Ficha 4 |

## Ferramentas e guias abertos

| Fonte | O que sustenta | Onde |
|---|---|---|
| [axe-core](https://github.com/dequelabs/axe-core) e a [descrição das regras na versão 4.11.4](https://github.com/dequelabs/axe-core/blob/v4.11.4/doc/rule-descriptions.md) | Motor da trava. Impacto de cada regra: `color-contrast`, `link-name` e `target-size` são "serious"; `meta-viewport` é "moderate" | Trava |
| [Deque, cobertura de teste automático (2021)](https://www.deque.com/automated-accessibility-testing-coverage/) | 57,38% dos problemas, contados por quantidade, em mais de 13 mil páginas. Número do fabricante do axe | README da trava |
| [Accessibility Insights, FastPass](https://accessibilityinsights.io/docs/web/getstarted/fastpass/) | Menos de cinco minutos; teste automático mais teste assistido de Tab, com ajuda visual | Fichas 1 e 3 |
| [Primer, checklist para design](https://primer.style/accessibility/tools-and-resources/checklists/designer-checklist/) | Foco visível em todo elemento interativo; ordem do foco anotada; 4,5:1 e 3:1; alvo de 24 por 24 px; títulos anotados | Ficha 2 |
| [GitHub Annotation Toolkit](https://github.com/github/annotation-toolkit) | Biblioteca de anotações para o Figma, licença CC BY 4.0 | Ficha 2 |
| [GitLab, guia de design para contribuições](https://docs.gitlab.com/development/contributing/design/) | Estados: erro, repouso, carregando, foco, hover, selecionado, desabilitado; e os que dependem de dados, como vazio | Ficha 2 |
| [Playwright, testes de acessibilidade](https://playwright.dev/docs/accessibility-testing) | Falha conhecida guardada por uma "impressão digital", não pelo HTML inteiro | Linha de base da trava |
| [pa11y-ci](https://github.com/pa11y/pa11y-ci) | Ações antes do teste: clicar, preencher, esperar | Roteiro da trava |
| [Siteimprove Alfa, regra SIA-R65](https://alfa.siteimprove.com/rules/sia-r65) | Existe teste automático de foco visível fora do axe | Ficha 1 e CHANGELOG |
| [Lighthouse, como a nota é calculada](https://developer.chrome.com/docs/lighthouse/accessibility/scoring) | A nota é média ponderada; as auditorias manuais não entram nela | README da trava |
| [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) | Alternativa para quem já mede desempenho | README da trava |
| [Guidepup](https://github.com/guidepup/guidepup) | Leitor de tela automatizado. Não testado com este kit | README da trava |
| [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) | Medir contraste de graça | Ficha 2 |

## GitHub e publicação

Conferidos em 20/11/2026.

| Fonte | O que sustenta | Onde |
|---|---|---|
| [GitHub, sobre rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) | Rulesets em repositório público em qualquer plano; em privado, só com Pro, Team ou Enterprise Cloud | Guia do GitHub |
| [GitHub, criar rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository) | Caminho na tela; digitar o nome do check e clicar no +; lista de bypass e o modo "For pull requests only" | Guia do GitHub |
| [GitHub, gerenciar rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository) | Importar um ruleset de um arquivo JSON | Guia do GitHub |
| [GitHub, regras disponíveis](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) | Pull request obrigatório não exige aprovação; app como fonte esperada do check; branch atualizada custa mais execuções | Guia do GitHub, regra pronta |
| [GitHub, API de rulesets](https://docs.github.com/en/rest/repos/rules) | Campos do ruleset; o modo `evaluate` só existe no Enterprise | Regra pronta |
| [GitHub, checks obrigatórios](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) | O check precisa ter passado no repositório nos últimos sete dias; fila de merge pede o gatilho `merge_group` | Guia do GitHub, exemplo de workflow |
| [GitHub, branches protegidas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) | Nome de job único entre todos os workflows | Guia do GitHub, exemplo de workflow |
| [GitHub, status checks](https://docs.github.com/en/pull-requests/reference/status-checks) | Job pulado aparece como sucesso, mesmo obrigatório | Guia do GitHub, exemplo de workflow, teste da trava |
| [GitHub, sintaxe de workflow](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) | Workflow pulado por filtro ou pela mensagem do commit deixa o check "Pending" | Guia do GitHub, exemplo de workflow, teste da trava |
| [GitHub, jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs) | `needs`: o deploy só roda depois que a trava passa | Guia do GitHub, exemplo de workflow |
| [GitHub, uso seguro](https://docs.github.com/en/actions/reference/security/secure-use) | Token só de leitura; não rodar código de terceiros com `pull_request_target`; action de terceiros fixada pelo SHA | Guia do GitHub |
| [Vercel, Deployment Checks](https://vercel.com/docs/deployment-checks) | Segura o deploy de produção até os checks passarem; "Force Promote" fura | Guia do GitHub |
| [Netlify, gerenciar deploys](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/) | Parar a publicação automática; nenhuma opção documentada de esperar os checks do GitHub | Guia do GitHub |

## Leitores de tela e navegadores

| Fonte | O que sustenta | Onde |
|---|---|---|
| [Apple, ligar e desligar o VoiceOver](https://support.apple.com/guide/voiceover/turn-voiceover-on-or-off-vo2682/mac) | Command + F5 | Ficha 1 |
| [WebAIM, VoiceOver](https://webaim.org/articles/voiceover/) | Teclas VO (Control + Option); VO + seta para a direita lê o próximo item; VO + U abre o rotor; Control para a leitura | Ficha 1 |
| [Guia do NVDA](https://download.nvaccess.org/documentation/userGuide.html) | Insert é a tecla NVDA; NVDA + Espaço alterna os modos; NVDA + Q e depois Enter sai | Ficha 1 |
| [WebAIM, NVDA](https://webaim.org/articles/nvda/) | H títulos, D regiões, K links, F campos, B botões; Ctrl para a leitura | Ficha 1 |
| [Apple, ajustes avançados do Safari](https://support.apple.com/guide/safari/advanced-ibrw1075/mac) | A opção de usar o Tab para destacar cada item da página | Ficha 1 |

## O caso do menu do DSGov

| Fonte | O que sustenta |
|---|---|
| [Dados do piloto de 30/07/2026](https://github.com/thiagoxikota/bold-dsgov-a11y-dataset/tree/main/data/piloto-2026-07) | 22 nós com falha antes, 0 depois; o código, o diff e os relatórios |
| [Chamado 261 no GitLab do DSGov](https://gitlab.com/govbr-ds/govbr-ds/-/work_items/261) | Aberto em 31/07/2026 |
| [Merge request 221 da govbr-ds-core](https://gitlab.com/govbr-ds/bibliotecas/javascript/govbr-ds-core/-/merge_requests/221) | Aberto em 01/09/2026 e incorporado em 13/10/2026 |
| [Versões de @govbr-ds/core no npm](https://www.npmjs.com/package/@govbr-ds/core?activeTab=versions) | Última versão publicada em 06/05/2026 (4.0.0-next.11, uma pré-versão), antes da correção; a última estável, 3.7.0, é de 19/11/2025 |
| [Dados abertos do estudo](https://github.com/thiagoxikota/bold-dsgov-a11y-dataset) | 277 registros; contraste é a regra mais frequente (128) |

Achou uma fonte que mudou ou saiu do ar? Abra uma issue.
