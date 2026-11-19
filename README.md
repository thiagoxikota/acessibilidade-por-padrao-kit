# Acessibilidade por padrão: kit prático

Material de apoio da palestra **"Acessibilidade por padrão"**, apresentada por Thiago Xikota no Detach! 26, em Fortaleza, em 21/11/2026.

O relatório acha a falha. A biblioteca evita que ela volte. Este kit traz o que dá para fazer a partir da próxima revisão: seis fichas curtas para o time de design e produto, e uma trava automática para o código.

## O que tem aqui

### Fichas, para a próxima revisão

| Ficha | Para quê |
|---|---|
| [1. Teste de teclado](fichas/01-teste-de-teclado.md) | Fazer a tarefa sem mouse e registrar onde o foco some |
| [2. O que entra no Figma antes do código](fichas/02-figma-antes-do-codigo.md) | Pares de cor, foco, estados e exemplo na biblioteca |
| [3. Teste o exemplo, não só o componente](fichas/03-teste-do-exemplo.md) | O exemplo da documentação é o que o time copia |
| [4. A trava, preenchida](fichas/04-trava-preenchida.md) | Qual teste, o que trava, o que já existia, exceção e quem responde |
| [5. "Meu PO não vai priorizar isso."](fichas/05-objecao-prioridade.md) | Proposta pequena, custo de verdade e o que é pronto |
| [6. Na próxima revisão](fichas/06-proxima-revisao.md) | Três movimentos que cabem numa revisão normal |

As fichas são Markdown simples: dá para copiar para o Notion, a wiki, o Figma ou imprimir.

### Trava, para o código

[trava/](trava/README.md) roda o axe-core em cada rota do site, em três modos de tela (normal, alto contraste e texto ampliado). Trava a mudança só quando aparece falha **nova e crítica**. O que já existia fica numa linha de base, com dono e prazo. Exceção precisa de motivo, de quem aprovou e de validade; vencida, trava de novo.

```sh
cd trava
npm install
npx playwright install chromium
BASE_URL=http://localhost:4321 npm run trava
```

A trava tem teste próprio (`npm test`), que roda a cada mudança neste repositório.

Verde quer dizer: a máquina não achou erro novo. Teste automático não substitui o teste com gente.

## O estudo por trás

- **Página do estudo:** [thiagoxikota.com/acessibilidade-por-padrao](https://thiagoxikota.com/acessibilidade-por-padrao). Estudo, dados, testes e chamado numa página.
- **Dados abertos:** [bold-dsgov-a11y-dataset](https://github.com/thiagoxikota/bold-dsgov-a11y-dataset). Relatórios brutos e scripts da auditoria de acessibilidade dos design systems Bold (UFSC) e DSGov (gov.br), com 277 registros.

## Licenças

- Código (pasta `trava/`): [MIT](LICENSE-MIT).
- Fichas e textos: [CC BY 4.0](LICENSE-CC-BY-4.0). Pode copiar, adaptar e usar no seu time; cite a fonte.

Achou um erro ou quer sugerir uma ficha? Abra uma issue.
