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

import {cpSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename} from 'node:path';
import pug from 'pug';
import {revisions} from '../../public/monad/adapter.mjs';

const destination = 'dist-monad';
const staticRoot = './static/';
if (!existsSync('public/monad/mce-wasm.wasm')) throw new Error('Run npm run build:monad:wasm first');
mkdirSync(destination, {recursive: true});
cpSync('out/webpack/static', `${destination}/static`, {recursive: true});
cpSync('public/monad', `${destination}/static/monad`, {recursive: true});
const build = JSON.parse(readFileSync('public/monad/build.json', 'utf8'));
const manifest = JSON.parse(readFileSync('out/dist/manifest.json', 'utf8'));
const example = '6000\n35\n6001\n01\n6000\n52\n6020\n6000\nf3';
const language = {
    id: 'evm', name: 'EVM bytecode', monaco: 'evm', extensions: ['.hex'], alias: [],
    formatter: null, supportsExecute: false, logoFilename: null, logoFilenameDark: null,
    example, previewFilter: null, monacoDisassembly: 'asm', defaultCompiler: 'monad-wasm-latest', defaultLibs: '',
};
const compilers = revisions.map((revision, index) => ({
    id: `monad-wasm-${revision}`, name: `Monad · ${revision.replace('monad_', 'Monad ').toUpperCase()}`,
    lang: 'evm', version: build.commit.slice(0, 12), fullVersion: `Monad ${build.commit} · WebAssembly`,
    baseName: 'Monad', alias: [], options: '', group: 'monad-wasm', groupName: 'Monad · x86-64',
    compilerType: 'monad', notification: '', compilerCategories: ['Monad'], instructionSet: 'amd64',
    supportsExecute: false, supportsBinary: false, supportsBinaryObject: false, supportsIntel: false,
    supportsAsmDocs: false, supportsLibraryCodeFilter: false, tools: [], libsArr: [],
    possibleOverrides: [], possibleRuntimeTools: [], unwiseOptions: [],
    disabledFilters: ['binary', 'binaryObject', 'execute', 'intel', 'demangle', 'libraryCode', 'labels', 'trim'],
    $order: index,
}));
const policies = {cookies: {enabled: false, key: 'monad-cookies'}, privacy: {enabled: false, key: 'monad-privacy'}};
const options = {
    monadWasm: true, sharingEnabled: true, githubEnabled: false, showSponsors: false,
    defaultSource: '', compilers, languages: {evm: language},
    libs: {evm: {}}, remoteLibs: {}, tools: {evm: {}}, defaultLibs: {evm: ''},
    defaultCompiler: {evm: 'monad-wasm-latest'}, compileOptions: {evm: ''},
    supportsBinary: {evm: false}, supportsBinaryObject: {evm: false}, supportsExecute: false,
    supportsLibraryCodeFilter: false, sources: [], sentryDsn: '', release: build.commit.slice(0, 12),
    cookieDomainRe: '', localStoragePrefix: 'monad-ce-', cvCompilerCountMax: 6, defaultFontScale: 15,
    doCache: true, thirdPartyIntegrationEnabled: false, statusTrackingEnabled: false,
    policies, motdUrl: '', pageloadUrl: '', explainApiEndpoint: '', urlShortenService: 'none',
    mobileViewer: false, readOnly: false,
};
for (const [path, data] of Object.entries({languages: [language], 'compilers/evm': compilers, 'libraries/evm': [], 'tools/evm': []})) {
    const file = `${destination}/static/monad/api/${path}.json`;
    mkdirSync(file.slice(0, file.lastIndexOf('/')), {recursive: true});
    writeFileSync(file, JSON.stringify(data));
}
let html = pug.renderFile('views/index.pug', {
    ...options, monadStatic: true, httpRoot: './', staticRoot, storageSolution: 'null',
    compilerExplorerOptions: JSON.stringify(options), optionsHash: build.commit, faviconFilename: 'monad/icon.svg',
    extraBodyClass: 'monad-explorer', metadata: {ogTitle: 'Monad Compiler Explorer',
        ogDescription: 'Explore Monad’s x86-64 assembly. Compile EVM bytecode directly in your browser.'},
    require: name => `${staticRoot}${basename(manifest[name] ?? name)}`,
});
html = html.replace('</head>', `<link rel="stylesheet" href="${staticRoot}monad/theme.css"></head>`);
writeFileSync(`${destination}/index.html`, html);
writeFileSync(`${destination}/.nojekyll`, '');
cpSync('LICENSE', `${destination}/CE-LICENSE`);
cpSync('vendor/monad/LICENSE', `${destination}/MONAD-LICENSE`);
console.log(`Built ${destination}/ with Monad ${build.commit}`);
