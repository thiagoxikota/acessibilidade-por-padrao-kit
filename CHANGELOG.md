# Mudanças

## 2.3.1, 20/11/2026

Manutenção de versão, sem mudança no que a trava confere.

- **Node 22 ou mais novo.** O Node 20 saiu de suporte em 30/04/2026. O teste próprio agora roda no Node 22 e no 24, e o exemplo de workflow usa o 24.
- **Ações do GitHub atualizadas** no exemplo e no teste: `actions/checkout@v7`, `actions/setup-node@v7` e `actions/upload-artifact@v7`. As versões 4 miravam o Node 20, e o GitHub já avisava disso ao rodar o teste do kit.

## 2.3.0, 20/11/2026

Do aviso à trava, no GitHub. A trava já falhava o job, mas o kit não mostrava como chegar em "sem verde, sem merge".

### Trava

- **Guia do GitHub em três peças** ([trava/github.md](trava/github.md)): o teste roda a cada pull request, vira obrigatório na branch principal, e a publicação espera o verde (no próprio GitHub Actions, na Vercel e na Netlify). Cada passo cita a documentação oficial, lida em 20/11/2026, e os termos (CI/CD, pull request, merge, check, ruleset) vêm explicados numa frase.
- **Regra pronta da branch** ([trava/regra-da-main.json](trava/regra-da-main.json)), no formato da API de rulesets do GitHub: check `trava` obrigatório, mudança só por pull request, sem apagar nem reescrever a branch, e ninguém na lista de quem pode furar. Entra pela tela (Import a ruleset) ou por um comando do GitHub CLI.
- **Exemplo de workflow** explica os três jeitos de a trava falhar calada ou segurar tudo: filtro no gatilho deixa o check pendente para sempre, `if` no job dá sucesso falso, e nome de job repetido deixa o resultado ambíguo. Ganhou o gatilho `merge_group`, para quem usa fila de merge, e o exemplo de deploy roda só no push da `main`.
- **Teste próprio** de 94 para 97 casos: confere a regra pronta e o exemplo de workflow, e um caso planta um workflow errado para provar que a conferência acusa.

## 2.2.0, 19/11/2026

Terceira revisão do código, de novo à procura de verde falso. Cada correção da trava abaixo vem com um caso de teste que falha na 2.1.

### Trava

- **Em shadow DOM, um problema novo passava como um antigo já consertado.** A posição que o axe dá ao elemento (`xpath`) começa na raiz do componente, e dois componentes iguais tinham a mesma posição: um botão sem nome num componente novo era tomado pelo item antigo de outro, e a trava saía verde. Agora, dentro de shadow DOM, só o seletor reconhece o item.
- **Mudar o seletor não tira mais um item de baixo de uma exceção vencida.** A exceção vale também pelo seletor que a linha de base guardou para o mesmo elemento, e a trava avisa para trocar pelo seletor de agora. Limpar ou gerar a linha de base de novo não apaga esse seletor antigo enquanto a exceção o usar.
- **O mesmo elemento com um seletor em cada modo**, ou com o seletor mudado só num modo, era reconhecido só uma vez: o outro item virava "resolvido" sem ter sido consertado, e o reconhecido acusava "apareceu em modo novo". Agora a linha de base é casada em cada tela e modo: cada item vale onde foi registrado, e o impacto de agora é comparado com o do item que vale ali. Quando gerar a linha de base de novo junta esses itens num só, fica o prazo mais curto, com o dono dele, e a trava avisa se os donos ou os prazos eram diferentes.
- **`SEMPRE_TRAVA` é conferido.** Regra com erro de digitação, fora das tags de `REGRAS`, ou experimental ou obsoleta sem a etiqueta dela em `REGRAS` sumia calada, e o "sempre" era falso. Agora é erro de configuração. Com `experimental` em `REGRAS`, a regra experimental roda e trava.
- **`ESTRITO` aceita só `1` ou `0`.** `ESTRITO=true` desligava o modo estrito sem avisar.
- **Com `ESTRITO=1`, o prazo vencido de um item não trava mais o próprio conserto.**
- **Item da linha de base da versão 1, sem a lista de modos, só sai como resolvido numa execução com os quatro modos.** Antes, uma execução só com `normal` já o dava como consertado.
- **Gerar a linha de base de novo não apaga a tela ou o modo onde o axe não decidiu.** Antes, ele saía da lista, e a trava acusava "apareceu em modo novo" numa página que não tinha mudado.
- **`limpar-resolvidos` grava o seletor e o xpath de agora** nos itens reconhecidos pela posição, com o mesmo dono e prazo.
- **`texto-200` amplia também a fonte que o roteiro troca.** Antes, um elemento que mudava de classe ou de tamanho no `style` durante o roteiro ficava medido com o tamanho antigo.
- **No `texto-200`, o elemento que o roteiro clona ou recria (`innerHTML`) não dobra duas vezes.** Ele copiava o tamanho já ampliado e ia a 4 vezes: a caixa que cabia era acusada, e a que cortava de verdade saía da lista.
- **Rota que começa com `//` dá erro**, também no roteiro e na exceção, e também quando vira `//` depois que o navegador apaga tab e quebra de linha (`/`, tab, `/exemplo`). O navegador lia `//exemplo` como outro endereço, e a trava testava a página errada. `ROTAS` escrita uma por linha, em vez de vírgula, também dá erro: virava uma rota só.
- **Roteiro com campo desconhecido ou seletor vazio dá erro.** `{ "espera": "#menu" }` passava calado.
- **Prazo fora do formato** diz qual é o certo (AAAA-MM-DD).
- **Teste próprio** de 55 para 94 casos, e ele não herda mais a configuração da trava do terminal de quem o roda.

### Fichas e textos

- **Ficha 1:** cita a regra SIA-R65 do Siteimprove Alfa, diz o que é o axe e corrige a saída do NVDA (NVDA + Q e depois Enter).
- **Ficha 2:** o texto em 200% cita o WCAG 1.4.4, ao lado do 1.4.10.
- **Ficha 4:** sem jargão de programação.
- **Caso do menu do DSGov:** a pasta certa para começar, a limpeza no fim (a linha de base do caso não serve para o seu site), a conta exata dos 28 alvos de toque e as duas versões do pacote no npm (a pré-versão de 06/05/2026 e a última estável).
- **Manual da trava:** exceção e roteiro aparecem como lista, como o arquivo pede; o formato do prazo está escrito; e os limites novos (shadow DOM, linha de base da versão 1, campo de formulário no `texto-200`) estão descritos.
- **Links das regras do axe** apontam para a versão 4.11.4, a que a trava usa.

## 2.1.0, 19/11/2026

Segunda revisão do código e das fontes, à procura de verde falso. A versão 2.0 ainda deixava alguns caminhos abertos.

### Trava

- **Tag de regra com erro de digitação dá erro.** `REGRAS=wcag2aa-typo` selecionava zero regras e passava. Agora a trava confere se o axe conhece cada tag e dá erro se nenhuma regra rodou.
- **Versão do axe fixa e no relatório.** O axe-core fica em 4.11.4 e a versão sai no relatório, para comparar execuções.
- **"Resolvido" só com reteste completo.** Um item só sai da linha de base quando foi procurado de novo em cada tela e modo onde aparecia, com a mesma regra rodando. Resultado que o axe não conseguiu decidir não conta como conserto.
- **Problema conhecido e grave em tela ou modo novo trava.** Antes, ele se escondia na linha de base.
- **Roteiro termina em `esperar`.** Sem confirmar o estado, um clique que não fez nada deixava a trava olhar a tela errada.
- **`texto-200` imita o zoom só no texto.** Dobra o tamanho de fonte de cada elemento, inclusive em px, e já vale durante o roteiro. O sinal de texto cortado acha texto dentro de outro elemento e ignora a caixa que já cortava sem ampliar.
- **`BASE_URL` com subpasta funciona.** Antes, `https://exemplo.github.io/projeto/` testava a raiz do domínio. Endereço sem `http://` ou `https://` dá erro.
- **Exceção com rota sem `/`** e **item da linha de base com dono só de espaços** passam a ser apontados.
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
