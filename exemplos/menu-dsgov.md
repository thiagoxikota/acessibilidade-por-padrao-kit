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
| 19/11/2026 | Nenhuma versão publicada traz a correção ainda. A última, uma pré-versão (4.0.0-next.11), saiu em 06/05/2026; a última estável, 3.7.0, é de 19/11/2025. |

Corrigir na biblioteca é o passo que mais rende: o conserto chega a todo produto que usa o componente. Mas só chega quando sai numa versão e cada produto atualiza.

## 3. A trava, preenchida para este caso

Esta é a [ficha 4](../fichas/04-trava-preenchida.md) aplicada ao menu.

| Campo | Resposta |
|---|---|
| **Qual teste** | O axe roda na página do exemplo do menu, a cada mudança. |
| **O que trava** | Falha nova de impacto crítico ou sério. A mudança não entra. |
| **O que já existia** | Os 22 nós de antes entram na linha de base, com dono e prazo. Não travam, mas não somem. Na cópia sem CSS entram também 28 alvos de toque pequenos (veja abaixo). |
| **Exceção** | Se o time decidir manter os papéis de árvore até a próxima versão, registra quem aprovou, por quê e até quando. |
| **Quem responde** | Quem mantém o componente de menu. |

Com a [trava](../trava/README.md), dá para refazer o caso com os arquivos reais de antes e depois, guardados no repositório público de dados. Os números nos comentários são os que a trava 2.2 dá.

No primeiro terminal, na pasta que contém a pasta `acessibilidade-por-padrao-kit` (um nível acima dela):

```sh
git clone https://github.com/thiagoxikota/bold-dsgov-a11y-dataset
mkdir bold-dsgov-a11y-dataset/site
cp bold-dsgov-a11y-dataset/data/piloto-2026-07/before/menu-push.html bold-dsgov-a11y-dataset/site/
npx --yes serve@14.2.4 bold-dsgov-a11y-dataset/site -l 4321
```

Deixe esse rodando. No segundo terminal, na mesma pasta, com a trava já instalada (veja [Como usar](../trava/README.md#como-usar)):

```sh
cd acessibilidade-por-padrao-kit/trava
export BASE_URL=http://localhost:4321 ROTAS=/menu-push.html
P=../../bold-dsgov-a11y-dataset

npm run trava               # trava: 50 problemas
npm run linha-de-base       # grava os 50 em linha-de-base.json; preencha dono e prazo
npm run trava               # passa: os 50 já existiam

cp $P/data/piloto-2026-07/after/menu-push.html $P/site/   # o conserto
npm run trava               # passa: 22 resolvidos; 28 continuam
npm run limpar-resolvidos   # tira os 22 da linha de base

cp $P/data/piloto-2026-07/before/menu-push.html $P/site/  # alguém devolve o role="treeitem"
npm run trava               # trava: 22 problemas novos

rm -r linha-de-base.json trava-relatorio.json trava-capturas   # a linha de base do caso não serve para o seu site
unset BASE_URL ROTAS P
```

**Por que 50 e não 22.** A cópia não carrega o CSS do design system. Sem ele, os links do menu ficam do tamanho do texto, e a trava acusa também 28 alvos de toque abaixo de 24 px (`target-size`, impacto sério, WCAG 2.5.8). Esse número é da cópia sem estilo: o tamanho real dos alvos depende do CSS do DSGov, que ficou fora do recorte. Os 22 de estrutura aparecem nos quatro modos. Dos 28 de toque, 27 são links do menu, em três modos (com o texto em 200%, eles crescem e passam), e 1 é o botão Fechar o menu, nos quatro.

**O que o caso ensinou à própria trava.** Tirar `role="treeitem"` muda o seletor que o axe dá a 21 desses links. Na versão 2.0, a trava achava que eram 21 problemas resolvidos e 21 novos, e travava o próprio conserto. Agora ela reconhece o item também pela posição na página, avisa que o seletor mudou, e o `limpar-resolvidos` grava o seletor novo, com o mesmo dono e prazo.

## 4. O que ainda falta

Os quatro passos de uma correção que chega em quem usa:

1. **Aceitar o problema.** Feito: o time pegou o chamado.
2. **Corrigir na biblioteca.** Feito em 13/10/2026.
3. **Publicar uma versão.** Ainda não, até 19/11/2026.
4. **Chegar no produto.** Cada serviço que usa o menu precisa atualizar. Só aí a pessoa com leitor de tela percebe a diferença.

## Leitura honesta dos limites

- A auditoria de 30/07 foi feita numa cópia do exemplo, sem o CSS do design system. Ela isola a estrutura do HTML; contraste e tamanho dos alvos de toque ficaram fora desse recorte.
- O axe aponta falhas de estrutura. Ele não substitui ouvir o menu num leitor de tela nem testar com quem usa um.
- "Corrigido no código" não é "corrigido para quem usa". O passo 4 depende de cada produto.

## Fontes

- Auditoria antes e depois, com o código, o diff e os relatórios: [bold-dsgov-a11y-dataset, piloto de 30/07/2026](https://github.com/thiagoxikota/bold-dsgov-a11y-dataset/tree/main/data/piloto-2026-07)
- Chamado público: [GitLab do DSGov, item 261](https://gitlab.com/govbr-ds/govbr-ds/-/work_items/261)
- Correção incorporada: [govbr-ds-core, merge request 221](https://gitlab.com/govbr-ds/bibliotecas/javascript/govbr-ds-core/-/merge_requests/221)
- Versões publicadas: [@govbr-ds/core no npm](https://www.npmjs.com/package/@govbr-ds/core?activeTab=versions)
- Estudo completo: [thiagoxikota.com/acessibilidade-por-padrao](https://thiagoxikota.com/acessibilidade-por-padrao)
