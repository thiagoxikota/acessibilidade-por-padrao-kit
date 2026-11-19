// Teste da propria trava: sobe um servidor local com paginas de falha conhecida e
// confere se ela trava, libera e acusa erro de configuracao nos casos certos.
// Uso: npm test
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const trava = join(aqui, '..', 'trava.mjs');

// /pagina.html serve a pagina indicada em `estado.pagina`: permite simular conserto e regressao.
// /sub/<pagina> serve a mesma pagina, para testar BASE_URL com subpasta. `pedidos` guarda o que foi pedido.
const estado = { pagina: 'com-falha.html', pedidos: [] };
const servidor = createServer((req, res) => {
  estado.pedidos.push(req.url);
  let nome = req.url.split('?')[0].replace(/^\/(sub\/)?/, '');
  if (nome === 'pagina.html') nome = estado.pagina;
  const arquivo = join(aqui, 'paginas', nome);
  if (!/^[a-z-]+\.html$/.test(nome) || !existsSync(arquivo)) {
    res.writeHead(404).end('nao encontrado');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(readFileSync(arquivo));
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const BASE_URL = `http://127.0.0.1:${servidor.address().port}`;

const novaPasta = () => mkdtempSync(join(tmpdir(), 'trava-'));

async function rodar({ env = {}, args = [], pasta = novaPasta() } = {}) {
  const ambiente = {
    ...process.env,
    BASE_URL,
    MODOS: 'normal',
    LINHA_DE_BASE: join(pasta, 'linha-de-base.json'),
    EXCECOES: join(pasta, 'excecoes.json'),
    RELATORIO: join(pasta, 'relatorio.json'),
    CAPTURAS: '0',
    HOJE: '2026-11-21',
    GITHUB_STEP_SUMMARY: '',
    ...env,
  };
  const filho = spawn(process.execPath, [trava, ...args], { env: ambiente });
  let saida = '';
  filho.stdout.on('data', (d) => (saida += d));
  filho.stderr.on('data', (d) => (saida += d));
  const codigo = await new Promise((ok) => filho.on('close', ok));
  return { codigo, saida, pasta, ambiente };
}

const lerJson = (arquivo) => JSON.parse(readFileSync(arquivo, 'utf8'));
const excecoes = (validade, extra = {}) => [
  { regra: 'image-alt', seletor: '#foto', motivo: 'imagem nova chega com o texto alternativo na proxima entrega', aprovado_por: 'Pessoa responsavel', validade, ...extra },
  { regra: 'button-name', seletor: '#fechar', motivo: 'componente sai da biblioteca nesta versao', aprovado_por: 'Pessoa responsavel', validade, ...extra },
];

const casos = [];
async function caso(nome, esperado, fn) {
  let r;
  let falha = '';
  try {
    r = await fn();
    if (r.codigo !== esperado) falha = `saiu ${r.codigo}, esperado ${esperado}`;
    for (const t of r.espera || []) if (!falha && !r.saida.includes(t)) falha = `faltou na saida: "${t}"`;
    for (const t of r.naoEspera || []) if (!falha && r.saida.includes(t)) falha = `nao devia aparecer: "${t}"`;
    if (!falha && r.conferir) falha = r.conferir() || '';
  } catch (e) {
    falha = e.message;
  }
  casos.push({ nome, falha, saida: r?.saida || '' });
}

// 1. O basico
await caso('pagina limpa passa nos quatro modos', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/limpa.html', MODOS: 'normal,cores-forcadas,texto-200,largura-320' } })),
  espera: ['Passou'], naoEspera: ['Para revisar a mao (nao trava)'],
}));
await caso('falha grave nova trava', 1, async () => {
  const r = await rodar({ env: { ROTAS: '/com-falha.html' } });
  return { ...r, espera: ['Novo e grave', 'image-alt', 'button-name'],
    conferir: () => (lerJson(r.ambiente.RELATORIO).travas.length === 2 ? '' : 'relatorio devia ter 2 travas') };
});

// 2. Contraste e impacto
await caso('contraste baixo trava por padrao (impacto serious)', 1, async () => ({
  ...(await rodar({ env: { ROTAS: '/contraste.html' } })), espera: ['color-contrast', 'serious'],
}));
await caso('com IMPACTO=critical, contraste vira aviso', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/contraste.html', IMPACTO: 'critical' } })), espera: ['Avisos: 1', 'color-contrast'],
}));

// 3. Linha de base
const pastaBase = novaPasta();
await caso('gera linha de base com dono e prazo a definir', 0, async () => {
  const r = await rodar({ env: { ROTAS: '/com-falha.html' }, args: ['--gerar-linha-de-base'], pasta: pastaBase });
  return { ...r, conferir: () => {
    const b = lerJson(r.ambiente.LINHA_DE_BASE);
    return b.length === 2 && b.every((x) => x.dono === '[definir]' && x.prazo === '[definir]') ? '' : 'base devia ter 2 itens a definir';
  } };
});
await caso('o que ja existia nao trava, mas aparece sem dono', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/com-falha.html' }, pasta: pastaBase })),
  espera: ['Ja existiam (na linha de base): 2', 'sem dono'],
}));
await caso('ESTRITO=1 trava linha de base sem dono', 1, async () => ({
  ...(await rodar({ env: { ROTAS: '/com-falha.html', ESTRITO: '1' }, pasta: pastaBase })), espera: ['sem dono'],
}));
await caso('regerar a linha de base preserva dono e prazo', 0, async () => {
  const arq = join(pastaBase, 'linha-de-base.json');
  const b = lerJson(arq).map((x) => ({ ...x, dono: 'Time do menu', prazo: '2026-12-15' }));
  writeFileSync(arq, JSON.stringify(b));
  const r = await rodar({ env: { ROTAS: '/com-falha.html' }, args: ['--gerar-linha-de-base'], pasta: pastaBase });
  return { ...r, espera: ['2 mantiveram dono e prazo'],
    conferir: () => (lerJson(arq).every((x) => x.dono === 'Time do menu' && x.prazo === '2026-12-15') ? '' : 'dono ou prazo se perderam') };
});
await caso('dono so com espacos conta como sem dono', 1, async () => {
  const pasta = novaPasta();
  await rodar({ env: { ROTAS: '/com-falha.html' }, args: ['--gerar-linha-de-base'], pasta });
  const arq = join(pasta, 'linha-de-base.json');
  writeFileSync(arq, JSON.stringify(lerJson(arq).map((x) => ({ ...x, dono: '   ', prazo: '2026-12-15' }))));
  return { ...(await rodar({ env: { ROTAS: '/com-falha.html', ESTRITO: '1' }, pasta })), espera: ['sem dono'] };
});
await caso('prazo vencido aparece como pendencia', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/com-falha.html', HOJE: '2027-01-10' }, pasta: pastaBase })), espera: ['prazo vencido em 2026-12-15'],
}));

// 4. Conserto, escopo e regressao
const pastaConserto = novaPasta();
await caso('conserto aparece como resolvido', 0, async () => {
  estado.pagina = 'com-falha.html';
  await rodar({ env: { ROTAS: '/pagina.html' }, args: ['--gerar-linha-de-base'], pasta: pastaConserto });
  estado.pagina = 'limpa.html';
  return { ...(await rodar({ env: { ROTAS: '/pagina.html' }, pasta: pastaConserto })), espera: ['tirar da linha de base): 2'] };
});
await caso('rota fora do escopo nao conta como resolvida', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/limpa.html' }, pasta: pastaConserto })), naoEspera: ['Resolvidos'],
}));
await caso('--limpar-resolvidos tira so o que foi consertado', 0, async () => {
  const r = await rodar({ env: { ROTAS: '/pagina.html' }, args: ['--limpar-resolvidos'], pasta: pastaConserto });
  return { ...r, conferir: () => (lerJson(join(pastaConserto, 'linha-de-base.json')).length === 0 ? '' : 'base devia ficar vazia') };
});
await caso('regressao depois do conserto trava de novo', 1, async () => {
  estado.pagina = 'com-falha.html';
  return { ...(await rodar({ env: { ROTAS: '/pagina.html' }, pasta: pastaConserto })), espera: ['Novo e grave'] };
});

// 4b. "Resolvido" so com o item procurado de novo em todo lugar, com a mesma regra e resposta clara do axe
const pastaParcial = novaPasta();
await caso('conserto retestado em so um dos modos nao conta como resolvido', 0, async () => {
  estado.pagina = 'com-falha.html';
  await rodar({ env: { ROTAS: '/pagina.html', MODOS: 'normal,cores-forcadas' }, args: ['--gerar-linha-de-base'], pasta: pastaParcial });
  estado.pagina = 'limpa.html';
  return { ...(await rodar({ env: { ROTAS: '/pagina.html', MODOS: 'normal' }, pasta: pastaParcial })), naoEspera: ['Resolvidos'] };
});
await caso('--limpar-resolvidos mantem o que nao foi retestado em todos os modos', 0, async () => {
  const r = await rodar({ env: { ROTAS: '/pagina.html', MODOS: 'normal' }, args: ['--limpar-resolvidos'], pasta: pastaParcial });
  return { ...r, espera: ['sumiram sem ser procurados de novo'],
    conferir: () => (lerJson(join(pastaParcial, 'linha-de-base.json')).length === 2 ? '' : 'base devia continuar com 2 itens') };
});
await caso('com todos os modos retestados, o conserto sai da linha de base', 0, async () => {
  const r = await rodar({ env: { ROTAS: '/pagina.html', MODOS: 'normal,cores-forcadas' }, args: ['--limpar-resolvidos'], pasta: pastaParcial });
  return { ...r, conferir: () => (lerJson(join(pastaParcial, 'linha-de-base.json')).length === 0 ? '' : 'base devia ficar vazia') };
});
await caso('regra que nao rodou nao conta como resolvida', 0, async () => {
  const pasta = novaPasta();
  await rodar({ env: { ROTAS: '/com-falha.html' }, args: ['--gerar-linha-de-base'], pasta });
  return { ...(await rodar({ env: { ROTAS: '/com-falha.html', REGRAS: 'best-practice' }, pasta })), naoEspera: ['Resolvidos'] };
});
await caso('resultado que o axe nao decidiu nao conta como conserto', 0, async () => {
  const pasta = novaPasta();
  estado.pagina = 'contraste.html';
  await rodar({ env: { ROTAS: '/pagina.html' }, args: ['--gerar-linha-de-base'], pasta });
  estado.pagina = 'contraste-incerto.html';
  return { ...(await rodar({ env: { ROTAS: '/pagina.html' }, pasta })), espera: ['Para revisar a mao', 'color-contrast'], naoEspera: ['Resolvidos'] };
});

// 4c. Problema conhecido que aparece em tela ou modo novo
const pastaEspalhou = novaPasta();
await caso('problema conhecido que aparece em modo novo trava', 1, async () => {
  await rodar({ env: { ROTAS: '/com-falha.html', MODOS: 'normal' }, args: ['--gerar-linha-de-base'], pasta: pastaEspalhou });
  return { ...(await rodar({ env: { ROTAS: '/com-falha.html', MODOS: 'normal,cores-forcadas' }, pasta: pastaEspalhou })),
    espera: ['Apareceu em tela ou modo novo', 'celular/cores-forcadas'] };
});
await caso('regerar registra o modo novo e guarda o modo que nao rodou', 0, async () => {
  await rodar({ env: { ROTAS: '/com-falha.html', MODOS: 'normal,cores-forcadas' }, args: ['--gerar-linha-de-base'], pasta: pastaEspalhou });
  await rodar({ env: { ROTAS: '/com-falha.html', MODOS: 'normal' }, args: ['--gerar-linha-de-base'], pasta: pastaEspalhou });
  const r = await rodar({ env: { ROTAS: '/com-falha.html', MODOS: 'normal,cores-forcadas' }, pasta: pastaEspalhou });
  return { ...r, espera: ['Ja existiam (na linha de base): 2'],
    conferir: () => (lerJson(join(pastaEspalhou, 'linha-de-base.json')).every((x) => x.onde.includes('celular/cores-forcadas')) ? '' : 'o modo que nao rodou sumiu da base') };
});

// 4d. O mesmo problema com outro seletor. No menu do DSGov, tirar role="treeitem" mudou o seletor
// que o axe gera para links que continuavam com alvo de toque pequeno. Sem reconhecer o item pela
// posicao na pagina (xpath), o conserto viraria "resolvido" falso mais "novo" falso, e travaria.
const pastaSeletor = novaPasta();
await caso('conserto que muda o seletor nao vira problema novo: o item e reconhecido pelo xpath', 0, async () => {
  estado.pagina = 'menu-arvore.html';
  await rodar({ env: { ROTAS: '/pagina.html' }, args: ['--gerar-linha-de-base'], pasta: pastaSeletor });
  const arq = join(pastaSeletor, 'linha-de-base.json');
  writeFileSync(arq, JSON.stringify(lerJson(arq).map((x) => ({ ...x, dono: 'Time do menu', prazo: '2026-12-15' }))));
  estado.pagina = 'menu-lista.html';
  const r = await rodar({ env: { ROTAS: '/pagina.html' }, pasta: pastaSeletor });
  return { ...r, espera: ['Ja existiam (na linha de base): 4', '3 deles mudaram de seletor', 'tirar da linha de base): 3'], naoEspera: ['Novo e grave'],
    conferir: () => {
      const antigos = lerJson(r.ambiente.RELATORIO).ja_existiam.filter((x) => x.seletor_na_base);
      return antigos.length === 3 && antigos.every((x) => x.seletor_na_base.includes('treeitem') && x.dono === 'Time do menu') ? '' : 'relatorio devia mostrar os 3 seletores antigos, com dono';
    } };
});
await caso('regerar atualiza o seletor e guarda dono e prazo', 0, async () => {
  const r = await rodar({ env: { ROTAS: '/pagina.html' }, args: ['--gerar-linha-de-base'], pasta: pastaSeletor });
  return { ...r, espera: ['4 mantiveram dono e prazo'], conferir: () => {
    const b = lerJson(join(pastaSeletor, 'linha-de-base.json'));
    if (b.length !== 4 || !b.every((x) => x.regra === 'target-size')) return `base devia ter os 4 alvos de toque, tem ${b.map((x) => x.regra).join(', ')}`;
    if (!b.every((x) => x.dono === 'Time do menu' && x.prazo === '2026-12-15')) return 'dono ou prazo se perderam';
    return b.some((x) => x.seletor.includes('treeitem')) ? 'seletor antigo ficou na base' : '';
  } };
});
await caso('quem devolve o role="treeitem" trava de novo', 1, async () => {
  estado.pagina = 'menu-arvore.html';
  const r = await rodar({ env: { ROTAS: '/pagina.html' }, pasta: pastaSeletor });
  estado.pagina = 'com-falha.html';
  return { ...r, espera: ['Novo e grave', 'aria-required-parent', 'Ja existiam (na linha de base): 4'] };
});

// 5. Excecoes
const comExcecoes = async (lista, env = {}, pasta = novaPasta()) => {
  writeFileSync(join(pasta, 'excecoes.json'), JSON.stringify(lista));
  return rodar({ env: { ROTAS: '/com-falha.html', ...env }, pasta });
};
await caso('excecao valida libera e mostra quem aprovou', 0, async () => ({
  ...(await comExcecoes(excecoes('2026-12-31'))), espera: ['aprovada por Pessoa responsavel'],
}));
await caso('excecao vencida trava', 1, async () => ({ ...(await comExcecoes(excecoes('2026-11-01'))), espera: ['Excecao vencida'] }));
await caso('excecao vencida trava mesmo com o item na linha de base', 1, async () => {
  const pasta = novaPasta();
  await rodar({ env: { ROTAS: '/com-falha.html' }, args: ['--gerar-linha-de-base'], pasta });
  return { ...(await comExcecoes(excecoes('2026-11-01'), {}, pasta)), espera: ['Excecao vencida'] };
});
await caso('excecao sem validade trava', 1, async () => ({
  ...(await comExcecoes([{ regra: 'image-alt', seletor: '#foto' }])), espera: ['Excecao invalida'],
}));
await caso('excecao com data impossivel trava', 1, async () => ({
  ...(await comExcecoes(excecoes('2026-02-30'))), espera: ['nao e uma data real'],
}));
await caso('excecao com rota sem a barra inicial e invalida', 1, async () => ({
  ...(await comExcecoes(excecoes('2026-12-31', { rota: 'com-falha.html' }))), espera: ['Excecao invalida', 'precisa comecar com /'],
}));
await caso('excecao que nao cobre nada vira aviso', 0, async () => ({
  ...(await comExcecoes([{ regra: 'image-alt', seletor: '#outra', motivo: 'x', aprovado_por: 'y', validade: '2026-12-31' }], { ROTAS: '/limpa.html' })),
  espera: ['pode sair do arquivo'],
}));

// 5b. Regras que travam sempre e limites conhecidos (metodo do teste do governo britanico:
// pagina com barreira plantada e teste que exige o resultado certo, inclusive o que nao e pego).
await caso('zoom bloqueado trava sempre, mesmo sendo moderate', 1, async () => ({
  ...(await rodar({ env: { ROTAS: '/zoom-bloqueado.html' } })), espera: ['meta-viewport', 'Novo e grave'],
}));
await caso('com SEMPRE_TRAVA vazio, zoom bloqueado vira aviso', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/zoom-bloqueado.html', SEMPRE_TRAVA: '' } })), espera: ['Avisos: 1'],
}));
await caso('LIMITE CONHECIDO: foco invisivel nao e pego pelo axe', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/foco-invisivel.html', MODOS: 'normal,cores-forcadas' } })), espera: ['Passou'],
}));

await caso('LIMITE CONHECIDO: ordem de foco diferente da ordem visual nao e pega', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/ordem-de-foco.html' } })), espera: ['Passou'],
}));

// 5c. Roteiro: estados que so aparecem depois de interagir
const roteiro = (lista) => {
  const pasta = novaPasta();
  const arq = join(pasta, 'roteiro.json');
  writeFileSync(arq, JSON.stringify(lista));
  return { pasta, arq };
};
await caso('menu fechado passa: a falha esta escondida', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/menu.html' } })), espera: ['Passou'],
}));
await caso('roteiro abre o menu e a falha escondida trava', 1, async () => {
  const { pasta, arq } = roteiro([{ rota: '/menu.html', estado: 'menu aberto', acoes: [{ clicar: '#abrir-menu' }, { esperar: '#menu' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq }, pasta })), espera: ['/menu.html [menu aberto]', 'button-name', '#fechar-menu'] };
});
await caso('roteiro com seletor que nao existe e erro de configuracao', 2, async () => {
  const { pasta, arq } = roteiro([{ rota: '/menu.html', estado: 'menu aberto', acoes: [{ clicar: '#nao-existe' }, { esperar: '#menu' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq }, pasta })), espera: ['nao conseguiu clicar'] };
});
await caso('roteiro que nao termina em esperar e erro de configuracao', 2, async () => {
  const { pasta, arq } = roteiro([{ rota: '/menu.html', estado: 'menu aberto', acoes: [{ clicar: '#abrir-menu' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq }, pasta })), espera: ['termine com "esperar"'] };
});
await caso('roteiro sem acoes e erro de configuracao', 2, async () => {
  const { pasta, arq } = roteiro([{ rota: '/menu.html', estado: 'menu aberto', acoes: [] }]);
  return rodar({ env: { ROTEIRO: arq }, pasta });
});

// 6. O que o axe nao mede vira revisao a mao
await caso('largura de 320 px acusa rolagem horizontal, sem travar', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/apertada.html', MODOS: 'largura-320' } })), espera: ['1.4.10', '#faixa'],
}));
await caso('texto a 200% acusa texto cortado, inclusive em px e dentro de span, sem travar', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/apertada.html', MODOS: 'texto-200' } })), espera: ['1.4.4', '#cartao', '#selo', '#caixa'], naoEspera: ['#carrossel'],
}));
await caso('no texto a 200%, o que o roteiro cria tambem e ampliado', 0, async () => {
  const { pasta, arq } = roteiro([{ rota: '/aviso.html', estado: 'depois de assinar', acoes: [{ clicar: '#assinar' }, { esperar: '#aviso' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq, MODOS: 'texto-200' }, pasta })), espera: ['1.4.4', '#aviso'] };
});
await caso('capturas de tela e resumo do GitHub sao gravados', 0, async () => {
  const pasta = novaPasta();
  const resumo = join(pasta, 'resumo.md');
  const r = await rodar({ env: { ROTAS: '/limpa.html', MODOS: 'normal,cores-forcadas', CAPTURAS: join(pasta, 'capturas'), GITHUB_STEP_SUMMARY: resumo }, pasta });
  return { ...r, conferir: () => {
    const n = readdirSync(join(pasta, 'capturas')).length;
    if (n !== 2) return `esperava 2 capturas, achou ${n}`;
    return readFileSync(resumo, 'utf8').includes('## Trava de acessibilidade') ? '' : 'resumo do GitHub nao foi escrito';
  } };
});

// 7. Configuracao errada nunca vira verde
await caso('sem BASE_URL e erro de configuracao', 2, async () => rodar({ env: { BASE_URL: '' } }));
await caso('ROTAS vazia e erro de configuracao', 2, async () => rodar({ env: { ROTAS: ',' } }));
await caso('IMPACTO com erro de digitacao e erro de configuracao', 2, async () => rodar({ env: { IMPACTO: 'critico' } }));
await caso('modo desconhecido e erro de configuracao', 2, async () => rodar({ env: { MODOS: 'escuro' } }));
await caso('REGRAS com etiqueta que nao existe e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/limpa.html', REGRAS: 'wcag2a,wacg21aa' } })), espera: ['"wacg21aa"', 'nao e tag do axe-core'],
}));
await caso('REGRAS que nao roda nenhuma regra e erro de configuracao (wcag21a sozinha, no axe 4.11)', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/limpa.html', REGRAS: 'wcag21a' } })), espera: ['nao rodou nenhuma regra'],
}));
await caso('BASE_URL sem http e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { BASE_URL: 'localhost:4321' } })), espera: ['http://'],
}));
await caso('BASE_URL com subpasta testa dentro da subpasta', 0, async () => {
  estado.pedidos.length = 0;
  const r = await rodar({ env: { BASE_URL: `${BASE_URL}/sub/`, ROTAS: '/limpa.html' } });
  return { ...r, conferir: () => (estado.pedidos.includes('/sub/limpa.html') ? '' : `pediu ${estado.pedidos.join(', ')}`) };
});
await caso('pagina 404 e erro de configuracao', 2, async () => rodar({ env: { ROTAS: '/nao-existe.html' } }));
await caso('excecoes com JSON quebrado e erro de configuracao', 2, async () => {
  const pasta = novaPasta();
  writeFileSync(join(pasta, 'excecoes.json'), '{ quebrado');
  return rodar({ env: { ROTAS: '/limpa.html' }, pasta });
});
await caso('excecoes que nao sao lista e erro de configuracao', 2, async () => {
  const pasta = novaPasta();
  writeFileSync(join(pasta, 'excecoes.json'), '{"regra":"image-alt"}');
  return rodar({ env: { ROTAS: '/limpa.html' }, pasta });
});

servidor.close();

let falhas = 0;
for (const c of casos) {
  if (c.falha) falhas++;
  console.log(`${c.falha ? 'FALHA' : 'ok   '} ${c.nome}${c.falha ? ` (${c.falha})` : ''}`);
  if (c.falha) console.log(c.saida.split('\n').map((l) => `      ${l}`).join('\n'));
}
console.log(falhas ? `\n${falhas} de ${casos.length} caso(s) falharam.` : `\nTodos os ${casos.length} casos passaram.`);
process.exit(falhas ? 1 : 0);
