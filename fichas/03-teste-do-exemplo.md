# Ficha 3. Teste o exemplo, não só o componente

## Por quê

O exemplo da documentação é o que o time copia. Se a estrutura do exemplo vem quebrada, ela vai junto para o produto.

No estudo que originou este kit, o exemplo do menu do DSGov foi copiado para uma página em branco, e a falha veio junto. Os exemplos de código também concentravam problemas de contraste: quem tem baixa visão não lê o próprio manual.

## Como fazer

1. Escolha um componente da documentação de vocês.
2. Copie o exemplo da documentação, como alguém do time faria, para uma página em branco.
3. Rode o teste automático nessa página (a [trava](../trava/README.md) serve).
4. Faça o [teste de teclado](01-teste-de-teclado.md) nela.
5. Teste uma condição que costuma ficar de fora:
   - texto ampliado a 200%;
   - alto contraste (cores forçadas do sistema);
   - tela de celular;
   - leitor de tela.
6. Leia a própria página da documentação: o texto dos blocos de código tem contraste suficiente?

## Registro

| Componente | Condição testada | Falhou? | A falha vem do exemplo ou do componente? | Onde consertar |
|---|---|---|---|---|
| | | | | biblioteca / exemplo / produto |

Se a falha vem da biblioteca, conserte na biblioteca. Assim ela some de todo lugar que usa o componente.
