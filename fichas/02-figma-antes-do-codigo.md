# Ficha 2. O que entra no Figma antes do código

O Figma registra a intenção. A prova é no navegador.

## Biblioteca: cores em pares

- [ ] Cores documentadas **em pares aprovados**: texto e fundo juntos, nas variáveis. Nenhuma cor solta.
- [ ] Cada par com o contraste medido e anotado. Os mínimos (nível AA):

| O quê | Mínimo | Critério |
|---|---|---|
| Texto normal | **4,5:1** | [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| Texto grande: a partir de 24 px, ou 18,5 px em negrito | **3:1** | WCAG 1.4.3 |
| Borda que mostra onde está o campo, ícone que informa, indicador de foco | **3:1** contra o que está ao lado | [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |

  Não arredonde: 4,49:1 não passa. Componente desabilitado e logotipo são exceção. Para medir: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/), grátis.

## Componente

- [ ] **Foco desenhado** e visível sobre qualquer fundo onde o componente aparece ([WCAG 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)).
- [ ] **Foco com contorno, não só sombra.** No alto contraste do sistema, sombra some ([CSS Color Adjustment](https://www.w3.org/TR/css-color-adjust-1/)).
- [ ] **Área de toque** de pelo menos 24 por 24 px, ou espaço livre em volta que complete isso ([WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). Os 44 por 44 px são do nível AAA.
- [ ] **Teclado:** quais teclas e em que ordem. Siga o padrão do componente na W3C ([padrões APG](https://www.w3.org/WAI/ARIA/apg/patterns/)): menu, abas, janela, acordeão.
- [ ] **O que o leitor de tela fala:** nome, papel e estado. Exemplo: "Menu, botão, recolhido".
- [ ] **Cada estado:** repouso, hover, foco, selecionado, desabilitado, carregando, erro e vazio.
- [ ] **Animação:** a versão sem animação, para quem desliga no sistema.

## Anotações na tela

Use as anotações do [Annotation Toolkit do GitHub](https://github.com/github/annotation-toolkit) (gratuito, CC BY 4.0) ou as suas. Marque:

- [ ] Ordem do foco, como o design pretende.
- [ ] Títulos (nível 1, 2, 3) e regiões: cabeçalho, navegação, conteúdo principal, rodapé.
- [ ] Texto alternativo de cada imagem que informa. Imagem decorativa marcada como decorativa.
- [ ] Nome de cada botão que só tem ícone.
- [ ] Avisos que aparecem sozinhos (erro, carregando, salvo) e como são anunciados.
- [ ] Como a tela fica com 320 px de largura e com o texto em 200% ([WCAG 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)).

## Exemplo da documentação

- [ ] O exemplo usa **o mesmo componente** que o produto usa.
- [ ] Nada de cópia solta ou desenho refeito à mão no exemplo.
- [ ] O texto dos blocos de código também tem contraste. Quem tem baixa visão também lê o manual.

## Entrega

- [ ] Gravação curta do teste de teclado ([ficha 1](01-teste-de-teclado.md)) volta para a documentação.
- [ ] Quando usar e quando não usar o componente, por escrito.

## Fontes

- GitHub Primer, [checklist para design](https://primer.style/accessibility/tools-and-resources/checklists/designer-checklist/)
- GitLab, [design e acessibilidade na entrega](https://docs.gitlab.com/development/contributing/design/)
- W3C, [WCAG 2.2](https://www.w3.org/TR/WCAG22/) e [padrões APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
