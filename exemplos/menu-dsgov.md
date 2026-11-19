# Caso completo: o menu do DSGov

Este é o caso real por trás das fichas. Ele mostra o caminho inteiro: o exemplo da documentação que o time copia, a falha que vai junto, o chamado, a correção na biblioteca e o que ainda falta para chegar em quem usa.

Todos os números e datas abaixo têm fonte pública, listada no fim.

## 1. O achado: o exemplo carrega a falha

O DSGov é o design system do governo federal (gov.br/ds). Na documentação do componente **Menu**, a aba de desenvolvimento traz o código de exemplo da variante "Menu Principal Empurrando (Push)". É o código que uma pessoa desenvolvedora copia e cola.

Em 30/07/2026, esse exemplo foi copiado sem nenhuma mudança para uma página em branco e auditado com o axe-core. Resultado: **22 nós com falha crítica de estrutura** (`aria-required-parent` em 21, `aria-required-children` em 1).

**O defeito:** o exemplo mistura dois modelos. Usa papéis de árvore (`role="tree"` e `role="treeitem"`) em cima de uma lista comum (`ul` e `li`). A estrutura que o leitor de tela lê fica inválida, e ele pode deixar de anunciar a lista como lista.

**A correção mínima:** tirar os papéis de árvore (1 `role="tree"` e 26 `role="treeitem"`). Nenhuma outra mudança. Na mesma auditoria, as falhas foram de 22 para 0. Essa cópia corrigida foi um experimento à parte, fora do DSGov.

Por que isso importa: quem copia o exemplo leva a falha para o próprio produto. É por isso que a [ficha 3](../fichas/03-teste-do-exemplo.md) pede para testar o exemplo, não só o componente.

## 2. O caminho até a biblioteca

| Data | O que aconteceu |
|---|---|
| 31/07/2026 | Chamado público aberto no GitLab do DSGov, com a correção pronta. |
| 01/09/2026 | Paula Coelho, do time do DSGov, abre a correção na biblioteca. Ela vai além da proposta: também move o `aria-expanded` para o botão que abre o menu. |
| 13/10/2026 | A correção do time do DSGov entra no código da biblioteca, 74 dias depois do aviso. |
| 19/11/2026 | Nenhuma versão publicada traz a correção ainda. A última saiu em 06/05/2026. |

Corrigir na biblioteca é o passo que mais rende: o conserto chega a todo produto que usa o componente. Mas só chega quando sai numa versão e cada produto atualiza.

## 3. A trava, preenchida para este caso

Esta é a [ficha 4](../fichas/04-trava-preenchida.md) aplicada ao menu.

| Campo | Resposta |
|---|---|
| **Qual teste** | O axe roda na página do exemplo do menu, a cada mudança. |
| **O que trava** | Falha nova de impacto crítico ou sério. A mudança não entra. |
| **O que já existia** | Os 22 nós de antes entram na linha de base, com dono e prazo. Não travam, mas não somem. |
| **Exceção** | Se o time decidir manter os papéis de árvore até a próxima versão, registra quem aprovou, por quê e até quando. |
| **Quem responde** | Quem mantém o componente de menu. |

Com a [trava](../trava/README.md), isso fica assim:

```sh
BASE_URL=http://localhost:4321 ROTAS=/exemplos/menu-push.html npm run linha-de-base
# preencher dono e prazo dos 22 itens em linha-de-base.json
BASE_URL=http://localhost:4321 ROTAS=/exemplos/menu-push.html npm run trava
# depois do conserto: os 22 aparecem como resolvidos
BASE_URL=http://localhost:4321 ROTAS=/exemplos/menu-push.html npm run limpar-resolvidos
# se alguém reintroduzir o role="treeitem", a falha volta como nova e trava
```

## 4. O que ainda falta

Os quatro passos de uma correção que chega em quem usa:

1. **Aceitar o problema.** Feito: o time pegou o chamado.
2. **Corrigir na biblioteca.** Feito em 13/10/2026.
3. **Publicar uma versão.** Ainda não, até 19/11/2026.
4. **Chegar no produto.** Cada serviço que usa o menu precisa atualizar. Só aí a pessoa com leitor de tela percebe a diferença.

## Leitura honesta dos limites

- A auditoria de 30/07 foi feita numa cópia do exemplo, sem o CSS do design system. Ela isola a estrutura do HTML; contraste ficou fora desse recorte.
- O axe aponta falhas de estrutura. Ele não substitui ouvir o menu num leitor de tela nem testar com quem usa um.
- "Corrigido no código" não é "corrigido para quem usa". O passo 4 depende de cada produto.

## Fontes

- Auditoria antes e depois, com o código, o diff e os relatórios: [bold-dsgov-a11y-dataset, piloto de 30/07/2026](https://github.com/thiagoxikota/bold-dsgov-a11y-dataset/tree/main/data/piloto-2026-07)
- Chamado público: [GitLab do DSGov, item 261](https://gitlab.com/govbr-ds/govbr-ds/-/work_items/261)
- Correção incorporada: [govbr-ds-core, merge request 221](https://gitlab.com/govbr-ds/bibliotecas/javascript/govbr-ds-core/-/merge_requests/221)
- Versões publicadas: [@govbr-ds/core no npm](https://www.npmjs.com/package/@govbr-ds/core?activeTab=versions)
- Estudo completo: [thiagoxikota.com/acessibilidade-por-padrao](https://thiagoxikota.com/acessibilidade-por-padrao)
