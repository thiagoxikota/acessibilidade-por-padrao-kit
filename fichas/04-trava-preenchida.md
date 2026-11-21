# Ficha 4. A trava, preenchida

Uma trava só funciona com regra. Preencha os cinco campos antes de ligar o teste automático. Sem dono, a trava vira só um alerta que todo mundo ignora.

## Exemplo: o menu do DSGov

| Campo | Resposta |
|---|---|
| **Qual teste** | O axe roda na página do exemplo do menu, a cada mudança. |
| **O que trava** | Falha nova e grave. A mudança não entra. |
| **O que já existia** | Vira tarefa, com dono e prazo. Não trava, mas não some. |
| **Exceção** | Fica registrada: quem aprovou, por quê e até quando. |
| **Quem responde** | Quem mantém o componente de menu. |

O caso completo está em [exemplos/menu-dsgov.md](../exemplos/menu-dsgov.md).

## Em branco, para o seu time

| Campo | Resposta |
|---|---|
| **Qual teste** | |
| **O que trava** | |
| **O que já existia** | |
| **Exceção** | |
| **Quem responde** | Responsável principal: <br> Apoio: |

## Como escrever uma boa regra

- **Como resultado que dá para testar.** Não "o banner é acessível", e sim "o texto do banner tem contraste de pelo menos 4,5:1 com o fundo". É assim que o governo britânico escreve os critérios dos componentes dele ([GOV.UK](https://docs.publishing.service.gov.uk/repos/govuk_publishing_components/accessibility_acceptance_criteria.html)).
- **Cada falha encontrada vira um critério novo**, tratado como um teste que falha. O mesmo guia do governo britânico recomenda isso. Se a falha voltar, alguém fica sabendo.
- **Um dono principal e um de apoio.** A W3C sugere marcar, para cada tarefa de acessibilidade, quem responde por ela (principal), quem ajuda a fazer (apoio) e quem precisa ser consultado. As funções vão de design e conteúdo a desenvolvimento ([ARRM, rascunho](https://www.w3.org/WAI/planning/arrm/)).

## Como isso vira código

A pasta [trava/](../trava/README.md) implementa essas regras:

| Campo | Na trava |
|---|---|
| **O que trava** | Falha nova de impacto `critical` ou `serious` no axe. Contraste baixo é `serious`, por isso entra. Zoom bloqueado conta como grave, embora seja `moderate` no axe: novo, trava; na linha de base, passa como os outros. |
| **O que já existia** | `linha-de-base.json`, com `dono` e `prazo`. Com `ESTRITO=1`, falta de dono ou prazo vencido também trava. |
| **Exceção** | `excecoes.json`, com `motivo`, `aprovado_por` e `validade`. Vencida, trava de novo. |
| **"Não vai pro ar"** | Só vale se o teste for **obrigatório** para a mudança entrar no código principal e se a publicação do site depender dele. |

Verde quer dizer: a máquina não achou falha nova. O teste com gente continua.
