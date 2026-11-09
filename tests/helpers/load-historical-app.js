import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadModuleSource(relativePath) {
  return readFileSync(new URL(`../../public/scripts/${relativePath}`, import.meta.url), 'utf8')
    .replace(/^(?:import .*?;\n)+\n/, '')
    .replaceAll('export let ', 'let ')
    .replaceAll('export const ', 'const ')
    .replaceAll('export async function ', 'async function ')
    .replaceAll('export function ', 'function ');
}

const dataSource = loadModuleSource('data.js');
const domainSource = loadModuleSource('domain.js');
const leagueSource = loadModuleSource('league.js');
const liveSource = loadModuleSource('live.js');
const applicationScript = loadModuleSource('app.js');
const cut = applicationScript.indexOf('function init()');
const source = `${dataSource}\n${domainSource}\n${leagueSource}\n${liveSource}\n${applicationScript.slice(0, cut)}`.replace(
  /document\.addEventListener\('error',[\s\S]*?\n\}\);/,
  ''
);
const exportsSource = `${source}\n;globalThis.__app = { seasons, MANAGERS_EXTRA, getFilteredSeasons, trailingStreak, longestEverStreak, seasonsSinceLastWin, seasonsForManager, comebackKing, buildStats, normalizeName, updateView, buildHistory, renderLiveStandings, loadLiveStandings, openLightboxAt, closeLightbox };`;

export function loadHistoricalApp({ document = globalThis.document, fetch = globalThis.fetch } = {}) {
  const documentStub = document ?? {
    addEventListener() {},
    removeEventListener() {}
  };
  const sandbox = {
    document: documentStub,
    fetch,
    URL,
    Date,
    console,
    navigator: globalThis.navigator,
    setTimeout,
    clearTimeout,
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(exportsSource, sandbox, { filename: 'scripts/app.js' });
  return sandbox.__app;
}

export function extractHistoricalDataset() {
  return loadHistoricalApp({ document: undefined, fetch: undefined }).seasons;
}
