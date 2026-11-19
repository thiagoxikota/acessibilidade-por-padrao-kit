# Ficha 5. "Meu PO não vai priorizar isso."

Quem prioriza o produto vai perguntar quanto custa. Leve uma resposta pequena e honesta.

## 1. Leve uma proposta pequena

| Item | Proposta |
|---|---|
| Uma tela | |
| Um tipo de falha | Exemplo: foco invisível, contraste, campo sem nome. |
| Uma pessoa responsável pelo teste | |

## 2. Diga o custo de verdade

- [ ] Corrigir o que o teste encontrar.
- [ ] Revisar a correção.
- [ ] Lidar com falso alerta.
- [ ] Manter e atualizar a ferramenta.
- [ ] Tempo de teste à mão, que a ferramenta não substitui.

Não prometa economia que ninguém mediu.

## 3. Combine o que é pronto

| Pergunta | Combinado |
|---|---|
| O que precisa estar testado? | |
| Qual prova vai junto? (gravação, relatório, captura) | |
| Quem confere? | |

## Se perguntarem: "a ferramenta não resolve sozinha?"

Não. Em 2017, o governo britânico montou uma página com 143 barreiras de acessibilidade e passou dez ferramentas automáticas nela ([GOV.UK](https://accessibility.blog.gov.uk/2017/02/24/what-we-found-when-we-tested-tools-on-the-worlds-least-accessible-webpage/)):

- As dez juntas acharam 71%.
- 42 barreiras (29%) não foram achadas por nenhuma.
- Sozinha, a melhor achou 41%, e isso contando os avisos de "confira à mão".

Por isso a proposta tem duas partes: a ferramenta, que é barata e roda sempre, e um teste à mão curto, na tela escolhida.

## Se perguntarem: "quando a gente testa?"

O manual de serviços do governo britânico responde assim ([GOV.UK](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility)):

- **Protótipo rascunho:** o código ainda não precisa ser acessível.
- **Desde a primeira linha de código de produção:** testes regulares, automáticos e à mão. Só o automático deixa problema passar.
- **Antes de abrir o serviço ao público:** auditoria formal, com as correções feitas. Para os serviços do governo britânico, é obrigatório.
- **Depois de aberto:** teste a cada funcionalidade nova.
