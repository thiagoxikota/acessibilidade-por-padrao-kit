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
    // A configuracao da trava vem so do caso, nunca do terminal de quem roda o teste (undefined nao passa).
    ROTAS: undefined, ROTEIRO: undefined, TELAS: undefined, IMPACTO: undefined, REGRAS: undefined,
    SEMPRE_TRAVA: undefined, ESPERA: undefined, ESTRITO: undefined,
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
  } finally {
    estado.pagina = 'com-falha.html';
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
await caso('ESTRITO com valor que nao e 1 e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/com-falha.html', ESTRITO: 'true' }, pasta: pastaBase })), espera: ['ESTRITO="true"'],
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
await caso('prazo fora do formato diz qual e o certo', 0, async () => {
  const pasta = novaPasta();
  const item = (regra, seletor, prazo) => ({ rota: '/com-falha.html', regra, seletor, impacto: 'critical', onde: ['celular/normal'], dono: 'Time do cadastro', prazo });
  writeFileSync(join(pasta, 'linha-de-base.json'), JSON.stringify([item('image-alt', '#foto', '15/12/2026'), item('button-name', '#fechar', '2026-12-15')]));
  return { ...(await rodar({ env: { ROTAS: '/com-falha.html' }, pasta })), espera: ['prazo invalido "15/12/2026" (use AAAA-MM-DD)'] };
});
await caso('prazo vencido aparece como pendencia', 0, async () => ({
  ...(await rodar({ env: { ROTAS: '/com-falha.html', HOJE: '2027-01-10' }, pasta: pastaBase })), espera: ['prazo vencido em 2026-12-15'],
}));
await caso('ESTRITO=1 nao trava o conserto de um item com prazo vencido', 0, async () => {
  const pasta = novaPasta();
  estado.pagina = 'com-falha.html';
  await rodar({ env: { ROTAS: '/pagina.html' }, args: ['--gerar-linha-de-base'], pasta });
  const arq = join(pasta, 'linha-de-base.json');
  writeFileSync(arq, JSON.stringify(lerJson(arq).map((x) => ({ ...x, dono: 'Time do cadastro', prazo: '2026-11-01' }))));
  estado.pagina = 'limpa.html';
  const r = await rodar({ env: { ROTAS: '/pagina.html', ESTRITO: '1' }, pasta });
  estado.pagina = 'com-falha.html';
  return { ...r, espera: ['tirar da linha de base): 2'], naoEspera: ['prazo vencido'] };
});

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
  estado.pagina = 'limpa.html';
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
  estado.pagina = 'limpa.html';
  const r = await rodar({ env: { ROTAS: '/pagina.html', MODOS: 'normal' }, args: ['--limpar-resolvidos'], pasta: pastaParcial });
  return { ...r, espera: ['sumiram sem ser procurados de novo'],
    conferir: () => (lerJson(join(pastaParcial, 'linha-de-base.json')).length === 2 ? '' : 'base devia continuar com 2 itens') };
});
await caso('com todos os modos retestados, o conserto sai da linha de base', 0, async () => {
  estado.pagina = 'limpa.html';
  const r = await rodar({ env: { ROTAS: '/pagina.html', MODOS: 'normal,cores-forcadas' }, args: ['--limpar-resolvidos'], pasta: pastaParcial });
  return { ...r, conferir: () => (lerJson(join(pastaParcial, 'linha-de-base.json')).length === 0 ? '' : 'base devia ficar vazia') };
});
await caso('regra que nao rodou nao conta como resolvida', 0, async () => {
  const pasta = novaPasta();
  await rodar({ env: { ROTAS: '/com-falha.html' }, args: ['--gerar-linha-de-base'], pasta });
  return { ...(await rodar({ env: { ROTAS: '/com-falha.html', REGRAS: 'best-practice', SEMPRE_TRAVA: '' }, pasta })), naoEspera: ['Resolvidos'] };
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
await caso('problema conhecido que aparece em tela nova trava', 1, async () => {
  const pasta = novaPasta();
  await rodar({ env: { ROTAS: '/com-falha.html' }, args: ['--gerar-linha-de-base'], pasta });
  return { ...(await rodar({ env: { ROTAS: '/com-falha.html', TELAS: 'celular,computador' }, pasta })),
    espera: ['Apareceu em tela ou modo novo', 'computador/normal'] };
});
await caso('regerar nao tira da linha de base o modo onde o axe nao decidiu', 0, async () => {
  const pasta = novaPasta();
  const arq = join(pasta, 'linha-de-base.json');
  writeFileSync(arq, JSON.stringify([{ rota: '/contraste-cores.html', regra: 'color-contrast', seletor: '#aviso', impacto: 'serious',
    onde: ['celular/normal', 'celular/cores-forcadas'], dono: 'Time do cadastro', prazo: '2026-12-15' }]));
  const r = await rodar({ env: { ROTAS: '/contraste-cores.html', MODOS: 'normal,cores-forcadas' }, args: ['--gerar-linha-de-base'], pasta });
  return { ...r, conferir: () => {
    const b = lerJson(arq);
    return b.length === 1 && b[0].onde.includes('celular/cores-forcadas') ? '' : `onde ficou ${JSON.stringify(b.map((x) => x.onde))}`;
  } };
});
await caso('regerar nao tira o modo onde o axe nao decidiu pelo seletor de agora', 0, async () => {
  // Em cores forcadas, o aviso tem outra classe e o axe nao decide o contraste dele. Procurado so pelo
  // seletor da linha de base, o modo pareceria retestado e sairia da lista.
  const pasta = novaPasta();
  const arq = join(pasta, 'linha-de-base.json');
  writeFileSync(arq, JSON.stringify([{ rota: '/contraste-classe.html', regra: 'color-contrast', seletor: '.aviso', impacto: 'serious',
    onde: ['celular/normal', 'celular/cores-forcadas'], dono: 'Time do cadastro', prazo: '2026-12-15' }]));
  const r = await rodar({ env: { ROTAS: '/contraste-classe.html', MODOS: 'normal,cores-forcadas' }, args: ['--gerar-linha-de-base'], pasta });
  return { ...r, conferir: () => {
    const b = lerJson(arq);
    return b.length === 1 && b[0].onde.includes('celular/cores-forcadas') ? '' : `onde ficou ${JSON.stringify(b.map((x) => x.onde))}`;
  } };
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
// Copia a linha de base de agora (com os seletores antigos) para uma pasta nova.
const copiaDaBase = (origem) => {
  const pasta = novaPasta();
  writeFileSync(join(pasta, 'linha-de-base.json'), readFileSync(join(origem, 'linha-de-base.json')));
  return pasta;
};
await caso('--limpar-resolvidos grava o seletor de agora e guarda dono e prazo', 0, async () => {
  const pasta = copiaDaBase(pastaSeletor);
  estado.pagina = 'menu-lista.html';
  const r = await rodar({ env: { ROTAS: '/pagina.html' }, args: ['--limpar-resolvidos'], pasta });
  const depois = await rodar({ env: { ROTAS: '/pagina.html' }, pasta });
  return { ...r, espera: ['3 resolvido(s) removido(s); 4 continuam (3 com o seletor ou o xpath de agora)'], conferir: () => {
    const b = lerJson(join(pasta, 'linha-de-base.json'));
    if (b.length !== 4 || b.some((x) => x.seletor.includes('treeitem'))) return 'base devia ter 4 itens, nenhum com o seletor antigo';
    if (!b.every((x) => x.dono === 'Time do menu' && x.prazo === '2026-12-15')) return 'dono ou prazo se perderam';
    return depois.codigo === 0 && !depois.saida.includes('mudaram de seletor') ? '' : 'a rodada seguinte ainda acha seletor mudado';
  } };
});
await caso('excecao vencida no seletor antigo continua travando depois que o seletor muda', 1, async () => {
  const pasta = copiaDaBase(pastaSeletor);
  const antigo = lerJson(join(pasta, 'linha-de-base.json')).find((x) => x.regra === 'target-size' && x.seletor.includes('treeitem'));
  writeFileSync(join(pasta, 'excecoes.json'), JSON.stringify([{ regra: 'target-size', seletor: antigo.seletor,
    motivo: 'menu novo chega na proxima versao', aprovado_por: 'Pessoa responsavel', validade: '2026-11-01' }]));
  estado.pagina = 'menu-lista.html';
  return { ...(await rodar({ env: { ROTAS: '/pagina.html' }, pasta })), espera: ['Excecao vencida', 'seletor antigo'] };
});
for (const [opcao, nome] of [['--limpar-resolvidos', 'limpar'], ['--gerar-linha-de-base', 'regerar']]) {
  await caso(`${nome} a linha de base nao apaga o seletor antigo que uma excecao vencida usa`, 1, async () => {
    const pasta = copiaDaBase(pastaSeletor);
    const antigo = lerJson(join(pasta, 'linha-de-base.json')).find((x) => x.regra === 'target-size' && x.seletor.includes('treeitem'));
    writeFileSync(join(pasta, 'excecoes.json'), JSON.stringify([{ regra: 'target-size', seletor: antigo.seletor,
      motivo: 'menu novo chega na proxima versao', aprovado_por: 'Pessoa responsavel', validade: '2026-11-01' }]));
    estado.pagina = 'menu-lista.html';
    const antes = await rodar({ env: { ROTAS: '/pagina.html' }, args: [opcao], pasta });
    const r = await rodar({ env: { ROTAS: '/pagina.html' }, pasta });
    return { ...r, espera: ['Excecao vencida'],
      conferir: () => (antes.saida.includes('1 item(ns) ficam com o seletor antigo porque uma excecao usa esse seletor') ? '' : `${opcao} devia avisar: ${antes.saida}`) };
  });
}
await caso('dentro de shadow DOM, problema novo em outro componente nao passa como o antigo consertado', 1, async () => {
  const pasta = novaPasta();
  estado.pagina = 'sombra-antes.html';
  await rodar({ env: { ROTAS: '/pagina.html' }, args: ['--gerar-linha-de-base'], pasta });
  estado.pagina = 'sombra-depois.html';
  const r = await rodar({ env: { ROTAS: '/pagina.html' }, pasta });
  estado.pagina = 'com-falha.html';
  return { ...r, espera: ['Novo e grave', '#b button', 'tirar da linha de base): 1'] };
});
// Itens escritos a mao, como ficam depois de o seletor mudar so em parte das telas e modos.
const itemFoto = (seletor, onde, extra = {}) => ({ rota: '/com-falha.html', regra: 'image-alt', seletor, xpath: "//img[@id='foto']", impacto: 'critical', onde: [onde], dono: 'Time do cadastro', prazo: '2026-12-15', ...extra });
const itemFechar = { rota: '/com-falha.html', regra: 'button-name', seletor: '#fechar', impacto: 'critical', onde: ['celular/normal', 'celular/cores-forcadas'], dono: 'Time do cadastro', prazo: '2026-12-15' };
const baseAMao = (itens) => {
  const pasta = novaPasta();
  writeFileSync(join(pasta, 'linha-de-base.json'), JSON.stringify(itens));
  return pasta;
};
const doisModos = { ROTAS: '/com-falha.html', MODOS: 'normal,cores-forcadas' };
await caso('o mesmo elemento com seletor diferente em cada modo e reconhecido como um so', 0, async () => {
  const pasta = baseAMao([itemFoto('img.foto-normal', 'celular/normal'), itemFoto('img.foto-contraste', 'celular/cores-forcadas'), itemFechar]);
  const r = await rodar({ env: doisModos, pasta });
  return { ...r, espera: ['Ja existiam (na linha de base): 2', '1 deles mudaram de seletor'], naoEspera: ['Apareceu em tela ou modo novo', 'Resolvidos'] };
});
const pastaUmModo = baseAMao([itemFoto('img.foto-antiga', 'celular/normal', { prazo: '2026-11-01' }), itemFoto('#foto', 'celular/cores-forcadas'), itemFechar]);
await caso('seletor que mudou so num modo nao vira problema novo nem resolvido falso', 0, async () => ({
  ...(await rodar({ env: doisModos, pasta: pastaUmModo })),
  espera: ['Ja existiam (na linha de base): 2', 'Rode --gerar-linha-de-base'], naoEspera: ['Apareceu em tela ou modo novo', 'Resolvidos'],
}));
await caso('regerar junta o mesmo elemento num item so, com o prazo mais curto', 0, async () => {
  const r = await rodar({ env: doisModos, args: ['--gerar-linha-de-base'], pasta: pastaUmModo });
  return { ...r, espera: ['2 mantiveram dono e prazo'], conferir: () => {
    const fotos = lerJson(join(pastaUmModo, 'linha-de-base.json')).filter((x) => x.regra === 'image-alt');
    if (fotos.length !== 1 || fotos[0].seletor !== '#foto' || fotos[0].onde.length !== 2) return `a foto devia virar 1 item em 2 modos: ${JSON.stringify(fotos)}`;
    return fotos[0].prazo === '2026-11-01' && fotos[0].dono === 'Time do cadastro' ? '' : `o prazo vencido se perdeu: ${fotos[0].prazo}`;
  } };
});
await caso('regerar que junta itens com donos diferentes fica com o prazo mais curto e o dono dele, e avisa', 0, async () => {
  const pasta = baseAMao([itemFoto('img.foto-antiga', 'celular/normal', { dono: 'Time A', prazo: '2026-11-01' }), itemFoto('#foto', 'celular/cores-forcadas', { dono: 'Time B' }), itemFechar]);
  const r = await rodar({ env: doisModos, args: ['--gerar-linha-de-base'], pasta });
  return { ...r, espera: ['1 item(ns) juntaram itens antigos com dono ou prazo diferentes'], conferir: () => {
    const [foto] = lerJson(join(pasta, 'linha-de-base.json')).filter((x) => x.regra === 'image-alt');
    return foto && foto.prazo === '2026-11-01' && foto.dono === 'Time A' ? '' : `devia ficar o prazo 2026-11-01 com o Time A: ${JSON.stringify(foto)}`;
  } };
});
await caso('item gravado para os dois modos continua reconhecido quando o site troca a classe so num modo', 0, async () => {
  const pasta = novaPasta();
  const arq = join(pasta, 'linha-de-base.json');
  const env = { ROTAS: '/pagina.html', MODOS: 'normal,cores-forcadas' };
  estado.pagina = 'foto-classe-fixa.html';
  const antes = await rodar({ env, args: ['--gerar-linha-de-base'], pasta });
  writeFileSync(arq, JSON.stringify(lerJson(arq).map((b) => ({ ...b, dono: 'Time do cadastro', prazo: '2026-12-15' }))));
  const umItem = lerJson(arq).length === 1 && lerJson(arq)[0].onde.length === 2;
  estado.pagina = 'foto-classe-por-modo.html';
  const r = await rodar({ env, pasta });
  const regerar = await rodar({ env, args: ['--gerar-linha-de-base'], pasta });
  return { ...r, espera: ['Ja existiam (na linha de base): 2'], naoEspera: ['Novo e grave', 'Resolvidos'], conferir: () => {
    if (!umItem) return `a primeira base devia ter 1 item nos 2 modos: ${antes.saida}`;
    const b = lerJson(arq);
    if (b.length !== 2 || new Set(b.map((x) => x.seletor)).size !== 2) return `a base regerada devia ter 1 item por seletor: ${regerar.saida}`;
    return b.every((x) => x.dono === 'Time do cadastro' && x.prazo === '2026-12-15') ? '' : `dono ou prazo se perderam: ${JSON.stringify(b)}`;
  } };
});
await caso('o mesmo elemento que piora num so modo trava', 1, async () => ({
  ...(await rodar({ env: doisModos, pasta: baseAMao([itemFoto('img.foto-normal', 'celular/normal', { impacto: 'moderate' }), itemFoto('img.foto-contraste', 'celular/cores-forcadas'), itemFechar]) })),
  espera: ['Piorou (era moderate'],
}));
await caso('ESTRITO=1 nao cobra o prazo do modo ja consertado do mesmo elemento', 0, async () => {
  const item = (seletor, onde, prazo) => ({ rota: '/so-no-computador.html', regra: 'image-alt', seletor, xpath: "//img[@id='so-grande']", impacto: 'critical', onde: [onde], dono: 'Time do cadastro', prazo });
  const pasta = baseAMao([item('img.velha', 'celular/normal', '2026-11-01'), item('img.outra', 'computador/normal', '2026-12-15')]);
  return { ...(await rodar({ env: { ROTAS: '/so-no-computador.html', TELAS: 'celular,computador', ESTRITO: '1' }, pasta })),
    espera: ['Ja existiam (na linha de base): 1', 'tirar da linha de base): 1'], naoEspera: ['prazo vencido'] };
});
await caso('--limpar-resolvidos grava o xpath de agora quando so a posicao mudou', 0, async () => {
  const pasta = baseAMao([{ ...itemFoto('#foto', 'celular/normal'), rota: '/pagina.html', xpath: '/html/body/div/img' }]);
  const r = await rodar({ env: { ROTAS: '/pagina.html' }, args: ['--limpar-resolvidos'], pasta });
  return { ...r, espera: ['(1 com o seletor ou o xpath de agora)'],
    conferir: () => (lerJson(join(pasta, 'linha-de-base.json'))[0].xpath === "//img[@id='foto']" ? '' : 'o xpath antigo ficou') };
});
await caso('item da versao 1, sem a lista de modos, so sai da linha de base depois dos quatro modos', 0, async () => {
  const pasta = baseAMao([{ rota: '/pagina.html', regra: 'image-alt', seletor: '#foto', impacto: 'critical', dono: 'Time do cadastro', prazo: '2026-12-15' }]);
  estado.pagina = 'limpa.html';
  const parcial = await rodar({ env: { ROTAS: '/pagina.html' }, args: ['--limpar-resolvidos'], pasta });
  const completo = await rodar({ env: { ROTAS: '/pagina.html', MODOS: 'normal,cores-forcadas,texto-200,largura-320' }, args: ['--limpar-resolvidos'], pasta });
  return { ...parcial, espera: ['0 resolvido(s) removido(s)', 'sumiram sem ser procurados de novo'],
    conferir: () => (completo.saida.includes('1 resolvido(s) removido(s)') ? '' : `com os quatro modos devia sair: ${completo.saida}`) };
});
await caso('regerar atualiza o seletor e guarda dono e prazo', 0, async () => {
  estado.pagina = 'menu-lista.html';
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
  ...(await comExcecoes(excecoes('2026-12-31', { rota: 'com-falha.html' }))), espera: ['Excecao invalida', 'precisa comecar com uma so /'],
}));
await caso('excecao com rota que comeca com // e invalida', 1, async () => ({
  ...(await comExcecoes(excecoes('2026-12-31', { rota: '//exemplo.com/com-falha.html' }))), espera: ['Excecao invalida', 'uma so /'],
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
await caso('SEMPRE_TRAVA com regra que REGRAS nao roda e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/zoom-bloqueado.html', REGRAS: 'wcag2a' } })), espera: ['"meta-viewport" nao roda com REGRAS=wcag2a', 'wcag2aa'],
}));
await caso('SEMPRE_TRAVA com regra experimental, sem experimental em REGRAS, e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/zoom-bloqueado.html', SEMPRE_TRAVA: 'css-orientation-lock' } })), espera: ['"css-orientation-lock" e regra experimental', 'so roda com "experimental" em REGRAS'],
}));
await caso('SEMPRE_TRAVA com regra obsoleta, sem deprecated em REGRAS, e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/zoom-bloqueado.html', SEMPRE_TRAVA: 'aria-roledescription' } })), espera: ['"aria-roledescription" e regra obsoleta (deprecated)', 'so roda com "deprecated" em REGRAS'],
}));
await caso('SEMPRE_TRAVA com regra experimental roda quando REGRAS inclui experimental', 1, async () => ({
  ...(await rodar({ env: { ROTAS: '/rotulo.html', REGRAS: 'wcag2a,wcag21a,experimental', SEMPRE_TRAVA: 'label-content-name-mismatch' } })), espera: ['Novo e grave', 'label-content-name-mismatch'],
}));
await caso('SEMPRE_TRAVA com regra que nao existe e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/zoom-bloqueado.html', SEMPRE_TRAVA: 'meta-viewpor' } })), espera: ['"meta-viewpor" nao e regra'],
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
  return { ...(await rodar({ env: { ROTEIRO: arq }, pasta })), espera: ['"acoes" precisa ser uma lista'] };
});
await caso('roteiro aceita a tecla Espaco (" ")', 1, async () => {
  const { pasta, arq } = roteiro([{ rota: '/menu.html', estado: 'menu aberto', acoes: [{ teclar: ' ' }, { clicar: '#abrir-menu' }, { esperar: '#menu' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq }, pasta })), espera: ['/menu.html [menu aberto]', '#fechar-menu'] };
});
await caso('roteiro com campo desconhecido e erro de configuracao', 2, async () => {
  const { pasta, arq } = roteiro([{ rota: '/menu.html', estado: 'menu aberto', acoes: [{ clicar: '#abrir-menu', espera: '#menu' }, { esperar: '#menu' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq }, pasta })), espera: ['campo desconhecido "espera"'] };
});
await caso('roteiro com rota que comeca com // e erro de configuracao', 2, async () => {
  const { pasta, arq } = roteiro([{ rota: '//exemplo.com/menu.html', estado: 'menu aberto', acoes: [{ clicar: '#abrir-menu' }, { esperar: '#menu' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq }, pasta })), espera: ['uma so /'] };
});
await caso('roteiro com seletor vazio e erro de configuracao', 2, async () => {
  const { pasta, arq } = roteiro([{ rota: '/menu.html', estado: 'menu aberto', acoes: [{ clicar: '#abrir-menu' }, { esperar: ' ' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq }, pasta })), espera: ['"esperar" precisa de'] };
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
await caso('no texto a 200%, a fonte que o roteiro troca tambem e ampliada', 0, async () => {
  const { pasta, arq } = roteiro([{ rota: '/fonte-muda.html', estado: 'destaque aberto', acoes: [{ clicar: '#destacar' }, { esperar: '#pronto' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq, MODOS: 'texto-200' }, pasta })), espera: ['passam a cortar o texto', '#caixa'], naoEspera: ['#vizinha', '#propria'] };
});
await caso('no texto a 200%, transicao de CSS nao leva a fonte a 4x depois do roteiro', 0, async () => {
  const { pasta, arq } = roteiro([{ rota: '/transicao.html', estado: 'detalhes abertos', acoes: [{ clicar: '#abrir' }, { esperar: '#pronto' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq, MODOS: 'texto-200' }, pasta })), espera: ['passam a cortar o texto', '#corta'], naoEspera: ['#cabe', 'scrollable-region-focusable'] };
});
await caso('no texto a 200%, elemento que o roteiro recria ou clona nao dobra duas vezes', 0, async () => {
  const { pasta, arq } = roteiro([{ rota: '/lista-recriada.html', estado: 'endereco adicionado', acoes: [{ clicar: '#adicionar' }, { esperar: '#pronto' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq, MODOS: 'texto-200' }, pasta })), espera: ['passam a cortar o texto', '#primeiro'], naoEspera: ['#segundo', '#novo', '#modelo', '#copia'] };
});
await caso('no texto a 200%, a fonte que o roteiro grava no style igual a da trava tambem dobra', 0, async () => {
  const { pasta, arq } = roteiro([{ rota: '/fonte-no-style.html', estado: 'plano aumentado', acoes: [{ clicar: '#aumentar' }, { esperar: '#pronto' }] }]);
  return { ...(await rodar({ env: { ROTEIRO: arq, MODOS: 'texto-200' }, pasta })), espera: ['passam a cortar o texto', '#caixa'] };
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
await caso('IMPACTO com erro de digitacao e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/limpa.html', IMPACTO: 'critico' } })), espera: ['impacto desconhecido "critico"'],
}));
await caso('modo desconhecido e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/limpa.html', MODOS: 'escuro' } })), espera: ['modo desconhecido "escuro"'],
}));
await caso('REGRAS com etiqueta que nao existe e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/limpa.html', REGRAS: 'wcag2a,wacg21aa' } })), espera: ['"wacg21aa"', 'nao e tag do axe-core'],
}));
await caso('REGRAS que nao roda nenhuma regra e erro de configuracao (wcag21a sozinha, no axe 4.11)', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/limpa.html', REGRAS: 'wcag21a', SEMPRE_TRAVA: '' } })), espera: ['nao rodou nenhuma regra'],
}));
await caso('rota que comeca com // e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '//exemplo.com/limpa.html' } })), espera: ['uma so /'],
}));
await caso('rota com tab, que o navegador apagaria e leria como outro servidor, e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/\t/limpa.html' } })), espera: ['nem quebra de linha'],
}));
await caso('ROTAS com uma rota por linha, em vez de virgula, e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/limpa.html\n/com-falha.html\n' } })), espera: ['Separe as rotas com virgula'],
}));
await caso('rota com barra invertida e erro de configuracao', 2, async () => ({
  ...(await rodar({ env: { ROTAS: '/\\limpa.html' } })), espera: ['nao pode ter \\,'],
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
await caso('o teste nao herda a configuracao da trava do terminal', 0, async () => {
  // Cada valor abaixo, se chegasse a trava, daria erro de configuracao (saida 2).
  const doTerminal = { ESTRITO: 'talvez', TELAS: 'relogio', IMPACTO: 'critico', REGRAS: 'nenhuma', SEMPRE_TRAVA: 'nenhuma', ESPERA: 'nunca', ROTEIRO: '/nao/existe.json' };
  const antes = Object.fromEntries(Object.keys(doTerminal).map((k) => [k, process.env[k]]));
  Object.assign(process.env, doTerminal);
  try {
    return { ...(await rodar({ env: { ROTAS: '/limpa.html' } })), espera: ['Passou'] };
  } finally {
    for (const [k, v] of Object.entries(antes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
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
