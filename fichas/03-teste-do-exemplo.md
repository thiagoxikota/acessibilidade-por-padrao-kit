# Ficha 3. Teste o exemplo, não só o componente

## Por quê

O exemplo da documentação é o que o time copia. Se a estrutura do exemplo vem quebrada, ela vai junto para o produto.

No estudo que originou este kit, o exemplo do menu do DSGov foi copiado para uma página em branco e a falha veio junto: 22 falhas críticas de estrutura. O caso inteiro, com fontes, está em [exemplos/menu-dsgov.md](../exemplos/menu-dsgov.md).

## Caminho sem dev (10 minutos)

1. Abra a página da documentação do componente, na parte do exemplo.
2. Rode o FastPass do [Accessibility Insights](https://accessibilityinsights.io/docs/web/getstarted/fastpass/). Ele mostra as falhas automáticas e desenha o caminho do Tab.
3. Faça o [teste de teclado](01-teste-de-teclado.md) no próprio exemplo. Se o componente abre (menu, janela), abra e teste aberto.
4. Amplie só o texto até 200% e veja se o exemplo continua inteiro.
5. Leia o texto dos blocos de código: dá para ler? Contraste baixo ali afeta quem desenvolve com baixa visão.

## Caminho com dev (15 minutos)

1. Copie o exemplo da documentação, como alguém do time faria, para uma página em branco.
2. Rode a [trava](../trava/README.md) nessa página.
3. Se o componente tem estados (menu aberto, erro), descreva o caminho num roteiro para a trava testar cada um.

## Condições que costumam ficar de fora

Escolha uma por revisão:

- [ ] Texto ampliado a 200%
- [ ] Tela de 320 px de largura
- [ ] Alto contraste do sistema
- [ ] Só teclado
- [ ] Leitor de tela
- [ ] Componente aberto ou com erro, não só no estado inicial

## Exemplo preenchido

| Componente | Condição testada | Falhou? | A falha vem de onde? | Onde consertar |
|---|---|---|---|---|
| Menu (DSGov), variante Push | Exemplo copiado para página em branco, axe | Sim: 22 falhas críticas de estrutura | Do exemplo da documentação: papéis de árvore em cima de uma lista | Na biblioteca, para chegar em todo produto |

## Registro

| Componente | Condição testada | Falhou? | A falha vem de onde? | Onde consertar |
|---|---|---|---|---|
| | | | exemplo / componente / produto | biblioteca / exemplo / produto |

Se a falha vem da biblioteca, conserte na biblioteca. Assim ela some de todo lugar que usa o componente, depois que sair numa versão e cada produto atualizar.
