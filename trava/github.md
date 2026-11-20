# Do aviso à trava, no GitHub

Sozinha, a trava só falha o job: aparece um X vermelho, e a mudança entra mesmo assim. Ela vira trava de verdade com três peças:

1. **O teste roda sozinho**, a cada mudança.
2. **O teste vira obrigatório**: sem verde, a mudança não entra.
3. **A publicação espera o verde**: o site só sobe depois que o teste passa.

Este guia monta as três no GitHub. Cada passo cita a documentação oficial, lida em 20/11/2026.

## As palavras, uma frase cada

| Palavra | O que é |
|---|---|
| **CI/CD** | A esteira automática que testa (CI) e publica (CD) cada mudança no código. |
| **Pull request** | O pedido para juntar uma mudança ao código principal. É nele que o teste roda e o resultado aparece. |
| **Merge** | Juntar a mudança ao código principal. |
| **Branch principal** | A versão oficial do código, a que vai para o ar. Em geral se chama `main`. |
| **Check** | O resultado de um teste, com nome, que aparece no pull request: verde ou X vermelho. |
| **Ruleset** | Um conjunto de regras para uma branch. Uma delas pode ser: sem este check verde, sem merge. |

## Peça 1. O teste roda sozinho

Copie [`exemplo-workflow.yml`](exemplo-workflow.yml) para `.github/workflows/acessibilidade.yml` no seu projeto. Ele roda a trava a cada pull request e a cada mudança na `main`. O check se chama `trava`, o nome do job.

Quatro cuidados para a trava não passar calada nem segurar o pull request para sempre:

- **Sem filtro no gatilho do pull request.** Se o workflow for pulado por filtro de pasta (`paths`), de branch ou pela mensagem do commit, como `[skip ci]`, o check fica "Pending", e o pull request que exige esse check não entra ([GitHub, sintaxe de workflow](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)). Para rodar mais rápido, diminua as rotas, não o gatilho.
- **Sem `if` no job `trava`, e sem `needs` de um job que pode falhar antes.** Um job pulado aparece como sucesso e não impede o merge, mesmo sendo obrigatório ([GitHub, status checks](https://docs.github.com/en/pull-requests/reference/status-checks)). E um job que depende de outro que falhou também é pulado ([GitHub, jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs)).
- **Nome de job único.** Se outro workflow do repositório tiver um job chamado `trava`, o resultado fica ambíguo e pode travar o pull request ([GitHub, branches protegidas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)).
- **Permissão mínima.** O exemplo dá ao workflow só leitura do código (`permissions: contents: read`). Não troque `pull_request` por `pull_request_target` para rodar código de pull request de outras pessoas, e fixe cada action de terceiros pelo SHA completo do commit, não pela versão ([GitHub, uso seguro](https://docs.github.com/en/actions/reference/security/secure-use)).

Se o repositório usa fila de merge (merge queue), o workflow também precisa do gatilho `merge_group`, que o exemplo já traz ([GitHub, checks obrigatórios](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)).

## Peça 2. O teste vira obrigatório

Uma regra na branch principal: sem o check `trava` verde, sem merge. Rulesets funcionam em repositório público em qualquer plano do GitHub; em repositório privado, só nos planos Pro, Team e Enterprise Cloud ([GitHub, rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)).

**Antes, rode a trava uma vez**, num pull request. O check obrigatório precisa ter passado no repositório nos últimos sete dias ([GitHub, checks obrigatórios](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)), e assim você confere o nome exato que aparece no pull request.

### Pela tela

1. No repositório, abra **Settings**.
2. Na barra lateral, em "Code, planning, and automation", abra **Rulesets**.
3. Clique em **New ruleset** e depois em **New branch ruleset**.
4. Dê um nome, como `trava-a11y`, e deixe **Enforcement status** em **Active**.
5. Em **Target branches**, inclua a branch padrão (**Include default branch**).
6. Marque **Require a pull request before merging**. Sem exigir aprovação, se o time é pequeno; em time, exija pelo menos uma.
7. Marque a regra de checks obrigatórios (**Require status checks to pass**), digite `trava` e **clique no botão +**. Sem o clique, o check não entra na regra ([GitHub, criar rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)).
8. Deixe a **Bypass list** vazia. Quem estiver nela pode furar a trava. Até no modo "For pull requests only", que deixa rastro no pull request, essa pessoa ainda consegue fazer o merge sem o verde ([GitHub, criar rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)).
9. Clique em **Create**.

**Opcional:** escolha **GitHub Actions** como a fonte esperada do check. Sem isso, qualquer pessoa ou integração com permissão de escrita no repositório pode marcar um check com o mesmo nome ([GitHub, regras disponíveis](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)).

### Com o arquivo pronto

[`regra-da-main.json`](regra-da-main.json) tem a mesma regra, no formato da [API de rulesets do GitHub](https://docs.github.com/en/rest/repos/rules).

- **Pela tela:** em Rulesets, abra o menu **New ruleset**, clique em **Import a ruleset**, escolha o arquivo, revise e clique em **Create** ([GitHub, gerenciar rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository)).
- **Pelo terminal**, com o [GitHub CLI](https://cli.github.com/), trocando `DONO/REPOSITORIO` pelo seu:

```sh
gh api --method POST repos/DONO/REPOSITORIO/rulesets --input regra-da-main.json
```

O que o arquivo liga:

| No arquivo | O que faz |
|---|---|
| `required_status_checks` com `trava` | Sem o check `trava` verde, sem merge. Erro de configuração da trava também deixa o check vermelho |
| `pull_request` | Toda mudança entra por pull request. Com `0` em `required_approving_review_count`, não exige aprovação; em time, use `1` ou mais |
| `deletion` e `non_fast_forward` | Ninguém apaga a branch principal nem reescreve a história dela |
| `bypass_actors` vazio | Ninguém passa por cima da regra enquanto ela estiver ativa, nem quem administra o repositório |
| `~DEFAULT_BRANCH` | Vale para a branch padrão, chame ela `main` ou outro nome |
| `strict_required_status_checks_policy` em `false` | Não exige o pull request atualizado com a `main` antes do merge. Em `true` é mais seguro, mas cada pull request precisa ser atualizado toda vez que a `main` anda, e o teste roda mais vezes ([GitHub, regras disponíveis](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)) |

O modo de teste, que avalia a regra sem bloquear (`evaluate`), só existe no GitHub Enterprise ([GitHub, API de rulesets](https://docs.github.com/en/rest/repos/rules)).

## Peça 3. A publicação espera o verde

Sem esta peça, o merge espera, mas o site pode subir por outro caminho. Depende de onde ele é publicado:

| Onde publica | Como fazer esperar |
|---|---|
| **No próprio GitHub Actions** | Um job de deploy com `needs: trava`, só no push da `main`. Está comentado no fim do [`exemplo-workflow.yml`](exemplo-workflow.yml). Se a trava falhar, o deploy nem roda |
| **Vercel** | Ligue os Deployment Checks, com o GitHub como provedor, e escolha o check `trava`. A Vercel segura o deploy de produção até o check passar. Exige o projeto ligado pelo Vercel for GitHub, e o botão "Force Promote" ainda fura a espera ([Vercel](https://vercel.com/docs/deployment-checks)) |
| **Netlify** | A documentação lida não traz opção de esperar os checks do GitHub. Dois caminhos: parar a publicação automática e publicar à mão depois do verde ([Netlify](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/)), ou publicar pelo próprio GitHub Actions, num job com `needs: trava` |
| **Outro serviço que publica a cada mudança na `main`** | Com a regra da peça 2, só chega na `main` o que passou na trava. O que for publicado de outra branch, ou à mão, fica fora dela |

## Como conferir que travou

Plante a barreira, como no [teste da própria trava](README.md#teste-da-própria-trava):

1. Abra um pull request de teste que tire o texto alternativo de uma imagem de uma rota testada.
2. O check `trava` fica vermelho, e o botão de merge fica bloqueado.
3. Feche o pull request sem fazer o merge.

Se o botão de merge continuar liberado, a regra não pegou: confira o nome do check e a lista de bypass.

Verde quer dizer: a máquina não achou falha nova e grave. Teclado, leitor de tela e teste com gente continuam ([ficha 1](../fichas/01-teste-de-teclado.md)).
