# Mudanças

## 2.1.0, 19/11/2026

Segunda revisão do código e das fontes, à procura de verde falso. A versão 2.0 ainda deixava alguns caminhos abertos.

### Trava

- **Tag de regra com erro de digitação dá erro.** `REGRAS=wcag2aa-typo` selecionava zero regras e passava. Agora a trava confere se o axe conhece cada tag e dá erro se nenhuma regra rodou.
- **Versão do axe fixa e no relatório.** O axe-core fica em 4.11.4 e a versão sai no relatório, para comparar execuções.
- **"Resolvido" só com reteste completo.** Um item só sai da linha de base quando foi procurado de novo em cada tela e modo onde aparecia, com a mesma regra rodando. Resultado que o axe não conseguiu decidir não conta como conserto.
- **Problema conhecido em tela ou modo novo trava.** Antes, ele se escondia na linha de base.
- **Roteiro termina em `esperar`.** Sem confirmar o estado, um clique que não fez nada deixava a trava olhar a tela errada.
- **`texto-200` imita o zoom só no texto.** Dobra o tamanho de fonte de cada elemento, inclusive em px, e já vale durante o roteiro. O sinal de texto cortado acha texto dentro de outro elemento e ignora a caixa que já cortava sem ampliar.
- **`BASE_URL` com subpasta funciona.** Antes, `https://exemplo.github.io/projeto/` testava a raiz do domínio. Endereço sem `http://` dá erro.
- **Exceção com rota sem `/` e dono só com espaços** passam a ser apontados.
- **Conserto que muda o seletor não trava mais o próprio conserto.** O axe identifica o elemento por um seletor que pode usar atributos. No menu do DSGov, tirar `role="treeitem"` mudou o seletor de 21 links que continuavam com alvo de toque pequeno: a trava os dava como resolvidos e, ao mesmo tempo, como novos, e travava o conserto. Agora a linha de base guarda também a posição do elemento na página (`xpath`), e o item é reconhecido por um ou por outro. Achado ao rodar o caso real de ponta a ponta.
- **Listas longas na saída** avisam quantos itens ficaram de fora ("e mais N no relatório").
- **Teste próprio** de 37 para 55 casos.

### Fichas e textos

- **Ficha 1:** dizia que nenhum teste automático pega foco invisível. Estava errado: há ferramenta que testa ([Siteimprove Alfa, regra SIA-R65](https://alfa.siteimprove.com/rules/sia-r65)). Agora diz que o axe e esta trava não pegam. O tempo por tarefa ficou realista.
- **Caso do menu do DSGov:** os comandos rodam nos arquivos reais de antes e depois, guardados no repositório de dados.
- **README:** o começo diz o que precisa instalar.

## 2.0.0, 19/11/2026

Revisão completa de veracidade, fontes e uso real. A versão 1 tinha dois problemas sérios: contraste baixo, a falha mais comum do estudo, passava pela trava; e várias regras das fichas não tinham fonte.

### Trava

- **Trava falha crítica e séria**, não só crítica. Contraste baixo, link sem nome e alvo de toque pequeno passam a travar.
- **Zoom bloqueado trava sempre** (`SEMPRE_TRAVA`), embora o axe o classifique como moderado.
- **Quatro modos.** Novo `largura-320`, que acusa rolagem horizontal (WCAG 1.4.10). O `texto-200` passa a acusar texto cortado (WCAG 1.4.4).
- **Roteiro** (`ROTEIRO`) para testar estados que só existem depois de um clique: menu aberto, erro de formulário.
- **Lista "Para revisar à mão"**, com o que o axe não consegue decidir e os sinais de layout. Não trava, mas não some.
- **Capturas de tela** de cada execução e resumo na página do job do GitHub.
- **Linha de base com governança.** Gerar de novo preserva dono, prazo e nota. `limpar-resolvidos` tira só o que foi consertado nas rotas e modos testados. Item sem dono, sem prazo ou com prazo vencido gera aviso; com `ESTRITO=1`, trava.
- **Exceção mais rígida.** Vale antes da linha de base. Vencida, trava mesmo para item antigo. Data impossível trava. Exceção que não cobre mais nada vira aviso.
- **Erro nunca vira verde.** Configuração errada, site fora do ar, JSON quebrado ou roteiro que não acha o botão saem com código 2. Na versão 1, um erro de execução saía com o mesmo código de "travou".
- **Data local** para validade e prazo (`TZ` no CI).
- **Teste próprio** de 8 para 37 casos, com barreiras plantadas de propósito. Inclui os dois limites conhecidos (foco invisível e ordem de foco): se um dia a trava passar a pegá-los, o teste avisa.

### Fichas

- **Todas com fonte.** Cada número, limite e atalho foi conferido na fonte. A lista está em [fontes.md](fontes.md).
- **Ficha 1:** preparo do Mac e do Safari, setas dentro de componentes, Esc que devolve o foco, foco encoberto, zoom só no texto, VoiceOver e NVDA em 5 minutos e o FastPass.
- **Ficha 2:** tabela de contraste, foco com contorno e não só sombra, área de toque de 24 px (44 px é do nível AAA), padrões de teclado da W3C, todos os estados e o Annotation Toolkit.
- **Ficha 3:** um caminho sem dev e um com dev, e o exemplo do menu preenchido.
- **Ficha 4:** como escrever uma regra testável, dono principal e de apoio, e como cada campo vira código.
- **Ficha 5:** o que a ferramenta automática não acha, com a ressalva de como cada número foi contado, e quando testar.
- **Ficha 6:** mais curta, sem repetir a ficha 3.

### Novo

- [exemplos/menu-dsgov.md](exemplos/menu-dsgov.md): o caso real, do exemplo da documentação à correção na biblioteca.
- [fontes.md](fontes.md): todas as fontes e o que cada uma sustenta.
- README com para quem é, um começo em 5 minutos, o que o kit não é e de onde vêm as ideias.

## 1.0.0, 19/11/2026

Primeira versão: seis fichas e uma trava com linha de base e exceção com validade, em três modos de tela, travando só falha crítica.
