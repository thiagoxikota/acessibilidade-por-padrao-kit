// Teste da propria trava: sobe um servidor local com duas paginas e confere
// se ela trava e libera nos casos certos.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const aqui = dirname(fileURLToPath(import.meta.url));
const trava = join(aqui, '..', 'trava.mjs');

const servidor = createServer((req, res) => {
  const nome = req.url === '/' ? 'limpa.html' : req.url.replace(/^\//, '');
  const arquivo = join(aqui, 'paginas', nome);
  if (!/^[a-z-]+\.html$/.test(nome) || !existsSync(arquivo)) {
    res.writeHead(404).end('nao encontrado');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(readFileSync(arquivo));
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const BASE_URL = `http://127.0.0.1:${servidor.address().port}`;

async function rodar(nome, extra, args = [], espera = null) {
  const pasta = mkdtempSync(join(tmpdir(), 'trava-'));
  const env = {
    ...process.env,
    BASE_URL,
    LINHA_DE_BASE: join(pasta, 'linha-de-base.json'),
    EXCECOES: join(pasta, 'excecoes.json'),
    RELATORIO: join(pasta, 'relatorio.json'),
    HOJE: '2026-11-21',
    ...extra.env,
  };
  if (extra.antes) extra.antes(env);
  const filho = spawn(process.execPath, [trava, ...args], { env });
  let saida = '';
  filho.stdout.on('data', (d) => (saida += d));
  filho.stderr.on('data', (d) => (saida += d));
  const codigo = await new Promise((ok) => filho.on('close', ok));
  return { nome, codigo, saida, env, espera };
}

const excecao = (validade) => (env) => writeFileSync(env.EXCECOES, JSON.stringify([{
  regra: 'image-alt', seletor: '#foto', motivo: 'imagem nova chega com o texto alternativo na proxima entrega',
  aprovado_por: 'Pessoa responsavel', validade,
}, {
  regra: 'button-name', seletor: '#fechar', motivo: 'componente sai da biblioteca nesta versao',
  aprovado_por: 'Pessoa responsavel', validade,
}]));

const casos = [];
casos.push([await rodar('pagina limpa passa', { env: { ROTAS: '/limpa.html' } }), 0]);
casos.push([await rodar('falha grave nova trava', { env: { ROTAS: '/com-falha.html' } }, [], 'Novo e grave'), 1]);

const gerar = await rodar('gera linha de base', { env: { ROTAS: '/com-falha.html' } }, ['--gerar-linha-de-base']);
casos.push([gerar, 0]);
casos.push([await rodar('o que ja existia nao trava', { env: { ROTAS: '/com-falha.html', LINHA_DE_BASE: gerar.env.LINHA_DE_BASE } }, [], 'Ja existiam (na linha de base): 2'), 0]);

casos.push([await rodar('excecao valida libera', { env: { ROTAS: '/com-falha.html' }, antes: excecao('2026-12-31') }), 0]);
casos.push([await rodar('excecao vencida trava', { env: { ROTAS: '/com-falha.html' }, antes: excecao('2026-11-01') }, [], 'Excecao vencida'), 1]);
casos.push([await rodar('excecao sem validade trava', { env: { ROTAS: '/com-falha.html' }, antes: (env) => writeFileSync(env.EXCECOES, JSON.stringify([{ regra: 'image-alt', seletor: '#foto' }])) }, [], 'Excecao invalida'), 1]);
casos.push([await rodar('sem BASE_URL e erro de configuracao', { env: { BASE_URL: '' } }), 2]);

servidor.close();

let falhas = 0;
for (const [r, esperado] of casos) {
  const ok = r.codigo === esperado && (!r.espera || r.saida.includes(r.espera));
  if (!ok) falhas++;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${r.nome} (saiu ${r.codigo}, esperado ${esperado})`);
  if (!ok) console.log(r.saida.split('\n').map((l) => `      ${l}`).join('\n'));
}
console.log(falhas ? `\n${falhas} caso(s) falharam.` : `\nTodos os ${casos.length} casos passaram.`);
process.exit(falhas ? 1 : 0);
