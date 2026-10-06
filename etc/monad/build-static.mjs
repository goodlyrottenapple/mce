// Copyright (c) 2026, Compiler Explorer Authors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {basename} from 'node:path';
import pug from 'pug';
import {revisions} from '../../public/monad/adapter.mjs';

const destination = 'dist-monad';
const staticRoot = './static/';
if (!existsSync('public/monad/mce-wasm.wasm')) throw new Error('Run npm run build:monad:wasm first');
mkdirSync(destination, {recursive: true});
cpSync('out/webpack/static', `${destination}/static`, {recursive: true});
const assetHash = createHash('sha256').update(readFileSync(import.meta.filename));
for (const file of readdirSync('public/monad').sort()) {
    assetHash.update(file).update(readFileSync(`public/monad/${file}`));
}
const monadAssetsPath = `monad/${assetHash.digest('hex').slice(0, 16)}/`;
cpSync('public/monad', `${destination}/static/${monadAssetsPath}`, {recursive: true});
const build = JSON.parse(readFileSync('public/monad/build.json', 'utf8'));
const manifest = JSON.parse(readFileSync('out/dist/manifest.json', 'utf8'));
const example = '6000\n35\n6001\n01\n6000\n52\n6020\n6000\nf3';
const hexLanguage = {
    id: 'evm', name: 'EVM bytecode', monaco: 'evm', extensions: ['.hex'], alias: [],
    formatter: null, supportsExecute: false, logoFilename: null, logoFilenameDark: null,
    example, previewFilter: null, monacoDisassembly: 'asm', defaultCompiler: 'monad-wasm-latest', defaultLibs: '',
};
const mnemonicLanguage = {
    ...hexLanguage, id: 'mevm', name: 'EVM mnemonics', monaco: 'mevm', extensions: ['.mevm'],
    example: readFileSync('examples/mevm/default.mevm', 'utf8'), defaultCompiler: 'monad-mnemonic-latest',
};
const languages = {mevm: mnemonicLanguage, evm: hexLanguage};
const hexCompilers = revisions.map((revision, index) => ({
    id: `monad-wasm-${revision}`, name: `Monad x86-64 · ${revision.replace('monad_', 'Monad ').toUpperCase()}`,
    lang: 'evm', version: build.commit.slice(0, 12), fullVersion: `Monad ${build.commit} · WebAssembly`,
    baseName: 'Monad', alias: [], options: '', group: 'monad-wasm', groupName: 'Monad · x86-64',
    compilerType: 'monad', notification: '', compilerCategories: ['Monad'], instructionSet: 'amd64',
    supportsExecute: false, supportsBinary: false, supportsBinaryObject: false, supportsIntel: false,
    supportsAsmDocs: false, supportsLibraryCodeFilter: false, tools: [], libsArr: [],
    possibleOverrides: [], possibleRuntimeTools: [], unwiseOptions: [],
    disabledFilters: ['binary', 'binaryObject', 'execute', 'intel', 'demangle', 'libraryCode', 'labels', 'trim'],
    $order: index,
}));
const mnemonicCompilers = hexCompilers.map(compiler => ({
    ...compiler, id: compiler.id.replace('monad-wasm-', 'monad-mnemonic-'), lang: 'mevm',
}));
mnemonicCompilers.push({
    ...mnemonicCompilers[0], id: 'monad-bytecode', name: 'EVM bytecode',
    group: 'monad-bytecode', groupName: 'EVM bytecode', instructionSet: 'evm', $order: revisions.length,
});
const compilers = [...mnemonicCompilers, ...hexCompilers];
const perLanguage = value => Object.fromEntries(Object.keys(languages).map(id => [id, value]));
const policies = {cookies: {enabled: false, key: 'monad-cookies'}, privacy: {enabled: false, key: 'monad-privacy'}};
const options = {
    monadWasm: true, monadAssetsPath, sharingEnabled: true, githubEnabled: false, showSponsors: false,
    defaultSource: '', compilers, languages,
    libs: perLanguage({}), remoteLibs: {}, tools: perLanguage({}), defaultLibs: perLanguage(''),
    defaultCompiler: {evm: 'monad-wasm-latest', mevm: 'monad-mnemonic-latest'}, compileOptions: perLanguage(''),
    supportsBinary: perLanguage(false), supportsBinaryObject: perLanguage(false), supportsExecute: false,
    supportsLibraryCodeFilter: false, sources: [], sentryDsn: '', release: build.commit.slice(0, 12),
    cookieDomainRe: '', localStoragePrefix: 'monad-ce-', cvCompilerCountMax: 6, defaultFontScale: 15,
    doCache: true, thirdPartyIntegrationEnabled: false, statusTrackingEnabled: false,
    policies, motdUrl: '', pageloadUrl: '', explainApiEndpoint: '', urlShortenService: 'none',
    mobileViewer: false, readOnly: false,
};
for (const [path, data] of Object.entries({languages: Object.values(languages),
    'compilers/evm': hexCompilers, 'compilers/mevm': mnemonicCompilers,
    'libraries/evm': [], 'tools/evm': [], 'libraries/mevm': [], 'tools/mevm': []})) {
    const file = `${destination}/static/${monadAssetsPath}api/${path}.json`;
    mkdirSync(file.slice(0, file.lastIndexOf('/')), {recursive: true});
    writeFileSync(file, JSON.stringify(data));
}
let html = pug.renderFile('views/index.pug', {
    ...options, monadStatic: true, httpRoot: './', staticRoot, storageSolution: 'null',
    compilerExplorerOptions: JSON.stringify(options), optionsHash: build.commit, faviconFilename: `${monadAssetsPath}icon.svg`,
    extraBodyClass: 'monad-explorer', metadata: {ogTitle: 'Monad Compiler Explorer',
        ogDescription: 'Explore Monad’s x86-64 assembly. Compile EVM mnemonics to bytecode or x86-64 directly in your browser.'},
    require: name => `${staticRoot}${basename(manifest[name] ?? name)}`,
});
html = html.replace('</head>', `<link rel="stylesheet" href="${staticRoot}${monadAssetsPath}theme.css"></head>`);
writeFileSync(`${destination}/index.html`, html);
writeFileSync(`${destination}/.nojekyll`, '');
cpSync('LICENSE', `${destination}/CE-LICENSE`);
cpSync('vendor/monad/LICENSE', `${destination}/MONAD-LICENSE`);
console.log(`Built ${destination}/ with Monad ${build.commit}`);
