# Acessibilidade por padrão: kit prático

Material de apoio da palestra **"277 problemas nos design systems do governo brasileiro"**, de Thiago Xikota, no Detach! 26, em Fortaleza, em 21/11/2026.

O relatório acha a falha. A biblioteca evita que ela volte. Este kit traz o que dá para fazer a partir da próxima revisão: seis fichas curtas para design e produto, um caso real contado do começo ao fim e uma trava automática para o código.

## Para quem

- **Quem faz design** e quer levar acessibilidade para o Figma e para a revisão, sem esperar uma auditoria.
- **Quem cuida de design system** e quer que o conserto chegue em todo produto que usa o componente.
- **Quem desenvolve** e quer um teste automático que trava o que é novo e grave, sem parar o time inteiro no primeiro dia.
- **Quem prioriza** e precisa de uma proposta pequena e honesta para levar adiante.

## Comece agora

**Sem instalar nada, em 5 minutos:** abra a [ficha 1](fichas/01-teste-de-teclado.md), escolha uma tarefa do seu produto e faça a tarefa só com o teclado. Anote onde o foco some.

**Com o código à mão:** rode a trava no seu site local. Precisa de Node 22 ou mais novo; a primeira instalação baixa um Chromium.

```sh
cd trava
npm install
npx playwright install chromium
BASE_URL=http://localhost:4321 npm run trava
```

## O que tem aqui

### Fichas, para a próxima revisão

| Ficha | Para quê |
|---|---|
| [1. Teste de teclado](fichas/01-teste-de-teclado.md) | Fazer a tarefa sem mouse, ampliar só o texto e ouvir a página num leitor de tela por 5 minutos |
| [2. O que entra no Figma antes do código](fichas/02-figma-antes-do-codigo.md) | Pares de cor com contraste medido, foco, área de toque, estados e anotações |
| [3. Teste o exemplo, não só o componente](fichas/03-teste-do-exemplo.md) | O exemplo da documentação é o que o time copia. Um caminho sem dev e um com dev |
| [4. A trava, preenchida](fichas/04-trava-preenchida.md) | Qual teste, o que trava, o que já existia, exceção e quem responde |
| [5. "Meu PO não vai priorizar isso."](fichas/05-objecao-prioridade.md) | Proposta pequena, custo de verdade, o que a ferramenta não acha e quando testar |
| [6. Na próxima revisão](fichas/06-proxima-revisao.md) | Três movimentos que cabem numa revisão normal. Para imprimir |

As fichas são Markdown simples: dá para copiar para o Notion, a wiki, o Figma ou imprimir.

### Caso real

[O menu do DSGov](exemplos/menu-dsgov.md): o exemplo da documentação levava 22 falhas críticas de estrutura para quem copiasse. O caso mostra o caminho inteiro, do chamado público à correção na biblioteca, com datas e fontes, e o que ainda falta para a correção chegar em quem usa.

### Trava, para o código

[trava/](trava/README.md) roda o axe-core em cada rota do site, em quatro modos: normal, alto contraste do sistema, texto em 200% e tela de 320 px.

- **Trava só o que é novo e grave:** falha de impacto crítico ou sério no axe, o que inclui contraste baixo. Zoom bloqueado trava sempre.
- **O que já existia** fica numa linha de base, com dono e prazo.
- **Exceção** precisa de motivo, de quem aprovou e de validade. Vencida, trava de novo.
- **Estados com interação** (menu aberto, erro de formulário) entram por um roteiro de cliques.
- **O que a máquina não consegue julgar** vai para uma lista de revisão à mão, com capturas de tela.
- **Configuração errada ou site fora do ar** dá erro. Nunca vira verde.
- **No GitHub**, um [guia em três peças](trava/github.md) e a [regra pronta da branch](trava/regra-da-main.json): o teste roda a cada pull request, sem verde não tem merge, e a publicação espera.

A trava tem teste próprio: 97 casos com barreiras plantadas de propósito, inclusive dois limites conhecidos que o axe não pega (foco invisível e ordem de foco). Esse teste roda a cada mudança neste repositório.

## O que este kit não é

- **Não é auditoria nem certificado.** A W3C diz das próprias checagens rápidas que elas cobrem só alguns problemas e foram feitas para ser rápidas e fáceis, não definitivas ([Easy Checks](https://www.w3.org/WAI/test-evaluate/preliminary/)). Vale o mesmo aqui.
- **Verde não quer dizer acessível.** Teste automático acha só parte dos problemas. Teclado, leitor de tela e teste com gente continuam.
- **Não substitui a WCAG.** Cada regra das fichas aponta para o critério de onde veio. A norma é a referência.

## De onde vêm as ideias

O kit junta o que já funciona em guias públicos e projetos abertos de acessibilidade. Cada fonte está citada onde é usada. A lista completa, com o que cada uma sustenta, está em [fontes.md](fontes.md).

| Ideia | De onde veio | Onde está |
|---|---|---|
| Teste rápido que admite o próprio limite | W3C, Easy Checks | Ficha 1 e este README |
| Tab entre componentes, setas dentro deles | W3C, padrões de teclado (APG) | Fichas 1 e 2 |
| Teste de Tab com o caminho desenhado na tela | Microsoft, Accessibility Insights FastPass | Fichas 1 e 3 |
| Checklist de design: foco, contraste, toque, títulos | GitHub, Primer | Ficha 2 |
| Anotações de acessibilidade no Figma | GitHub, Annotation Toolkit | Ficha 2 |
| Todos os estados do componente | GitLab, guia de design | Ficha 2 |
| Critério que dá para testar; cada falha vira critério | GOV.UK, critérios de aceite dos componentes | Ficha 4 |
| Quem responde, quem ajuda, quem é consultado | W3C, ARRM (rascunho) | Ficha 4 |
| Quando testar; combinações de leitor de tela | GOV.UK, manual de serviços | Fichas 1 e 5 |
| Plantar a barreira para testar a ferramenta | GOV.UK, auditoria de ferramentas | Teste da trava |
| Ações antes do teste: clicar, preencher, esperar | pa11y-ci | Roteiro da trava |
| Falha conhecida guardada pela "impressão digital" | Playwright, guia de testes de acessibilidade | Linha de base da trava |
| Travar por regra, não pela nota | Lighthouse, como a nota é calculada | README da trava |
| Check obrigatório na branch; job pulado conta como sucesso | GitHub, rulesets e status checks | Guia do GitHub da trava |

## O estudo por trás

- **Página do estudo:** [thiagoxikota.com/acessibilidade-por-padrao](https://thiagoxikota.com/acessibilidade-por-padrao). Estudo, dados, testes e chamado numa página.
- **Dados abertos:** [bold-dsgov-a11y-dataset](https://github.com/thiagoxikota/bold-dsgov-a11y-dataset). Relatórios brutos e scripts da auditoria de acessibilidade dos design systems Bold (UFSC) e DSGov (gov.br), com 277 registros.

## Licenças

- Código (pasta `trava/`): [MIT](LICENSE-MIT).
- Fichas e textos: [CC BY 4.0](LICENSE-CC-BY-4.0). Pode copiar, adaptar e usar no seu time; cite a fonte.

O que mudou em cada versão está em [CHANGELOG.md](CHANGELOG.md).

Achou um erro, um link quebrado ou quer sugerir uma ficha? Abra uma issue.
