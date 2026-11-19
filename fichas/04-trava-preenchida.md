# Ficha 4. A trava, preenchida

Uma trava só funciona com regra. Preencha os cinco campos antes de ligar o teste automático. Sem dono, a trava vira só um alerta que todo mundo ignora.

## Exemplo: o menu do DSGov

| Campo | Resposta |
|---|---|
| **Qual teste** | O Axe roda na página do exemplo do menu, a cada mudança. |
| **O que trava** | Falha crítica nova e confirmada. A mudança não vai pro ar. |
| **O que já existia** | Vira tarefa, com dono e prazo. Não trava, mas não some. |
| **Exceção** | Fica registrada: quem aprovou, por quê e até quando. |
| **Quem responde** | Quem mantém o componente de menu. |

## Em branco, para o seu time

| Campo | Resposta |
|---|---|
| **Qual teste** | |
| **O que trava** | |
| **O que já existia** | |
| **Exceção** | |
| **Quem responde** | |

## Como isso vira código

A pasta [trava/](../trava/README.md) implementa exatamente essas regras:

- **O que trava:** falha nova de impacto crítico (dá para incluir as sérias).
- **O que já existia:** fica em `linha-de-base.json`, com campos `dono` e `prazo`.
- **Exceção:** fica em `excecoes.json`, com `motivo`, `aprovado_por` e `validade`. Exceção vencida trava de novo.

Verde quer dizer: a máquina não achou erro novo. O teste com gente continua.
