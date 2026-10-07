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

import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from '@playwright/test';

const url = process.env.MCE_URL ?? 'http://127.0.0.1:10240/';
const browser = await chromium.launch({headless: true});
let page;
try {
    page = await browser.newPage({viewport: {width: 1440, height: 960}});
    const errors = [];
    const requests = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Page error:', error.stack); });
    page.on('response', response => { if (response.status() >= 400) console.error(response.status(), response.url()); });
    page.on('request', request => requests.push({url: request.url(), method: request.method()}));
    page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
    await page.goto(url);
    await page.waitForFunction(() => window.monaco?.editor.getModels().some(model => model.getValue().includes('ContractEpilogue:')), {timeout: 60000});
    assert.equal(await page.title(), 'Monad Compiler Explorer');
    assert.equal(await page.locator('.monad-wordmark strong').textContent(), 'monad');
    assert.equal(await page.locator('.monad-wordmark > span').textContent(), 'Compiler Explorer');
    const initial = await page.evaluate(() => window.monaco.editor.getModels().find(model => model.getLanguageId() === 'asm').getValue());
    assert.match(initial, /call qword ptr \[monad_vm_runtime_increase_memory_raw_v1_ptr\]/);
    assert.match(initial, /call qword ptr \[monad_vm_runtime_load_bounded_le_raw_ptr\]/);
    assert.doesNotMatch(initial, /call qword ptr \[ROD/);
    await page.evaluate(() => window.monaco.editor.getModels().find(model => model.getLanguageId() === 'mevm').setValue('push0\npush1 10\njumpdest .loop\ndup1\niszero\npush .done\njumpi\npush .loop\njump\njumpdest .done\nstop'));
    await page.waitForFunction(() => window.monaco.editor.getModels().some(model => model.getLanguageId() === 'asm' && model.getValue().includes('je Bc')));
    const branchPosition = await page.evaluate(() => {
        const editor = window.monaco.editor.getEditors().find(editor => editor.getModel()?.getLanguageId() === 'asm');
        const lineNumber = editor.getModel().getLinesContent().findIndex(line => line === 'je Bc') + 1;
        editor.revealLineInCenter(lineNumber, window.monaco.editor.ScrollType.Immediate);
        const position = editor.getScrolledVisiblePosition({lineNumber, column: 2});
        const bounds = editor.getDomNode().getBoundingClientRect();
        return {x: bounds.x + position.left, y: bounds.y + position.top + position.height / 2};
    });
    await page.mouse.move(branchPosition.x, branchPosition.y);
    await page.waitForFunction(() => window.monaco.editor.getModels().find(model => model.getLanguageId() === 'mevm').getAllDecorations().some(decoration => decoration.options.className === 'linked-code-decoration-line' && decoration.range.startLineNumber === 7));
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.monaco.editor.getModels().find(model => model.getLanguageId() === 'mevm').setValue('push1 5\npush1 6\nadd\npush1 0\nmstore\nstop'));
    await page.waitForFunction(() => window.monaco.editor.getModels().some(model => model.getLanguageId() === 'asm' && model.getValue().includes('ContractEpilogue:') && !model.getValue().includes('je Bc')));
    const compilerPicker = page.locator('.lm_content select.compiler-picker');
    await compilerPicker.evaluate(select => select.tomselect.setValue('monad-bytecode'));
    await page.waitForFunction(() => window.monaco.editor.getModels().some(model => model.getLanguageId() === 'evm' && model.getValue().replace(/\s/g, '') === '600560060160005200'));
    await page.evaluate(() => window.monaco.editor.getModels().find(model => model.getLanguageId() === 'mevm').setValue('push .end jump\njumpdest .end stop'));
    await page.waitForFunction(() => window.monaco.editor.getModels().some(model => model.getLanguageId() === 'evm' && model.getValue().replace(/\s/g, '') === '6003565b00'));
    await page.locator('.lm_content .output-btn').click();
    await page.evaluate(() => window.monaco.editor.getModels().find(model => model.getLanguageId() === 'mevm').setValue('// comment\nwat'));
    await page.waitForFunction(() => document.body.innerText.includes('Line 2: unknown opcode'));
    await page.evaluate(() => window.monaco.editor.getModels().find(model => model.getLanguageId() === 'mevm').setValue('push1 0\ncalldataload\npush1 1\nadd\npush1 0\nmstore\npush1 32\npush1 0\nreturn'));
    await compilerPicker.evaluate(select => select.tomselect.setValue('monad-mnemonic-latest'));
    await page.waitForFunction(() => window.monaco.editor.getModels().some(model => model.getLanguageId() === 'asm' && model.getValue().includes('ContractEpilogue:')));
    await page.locator('.lm_tab').filter({hasText: 'Output'}).locator('.lm_close_tab').click();
    const languagePicker = page.locator('.lm_content select.change-language');
    await languagePicker.evaluate(select => select.tomselect.setValue('evm'));
    await page.waitForFunction(() => window.monaco.editor.getModels().some(model => model.getLanguageId() === 'evm') && document.querySelector('.lm_content select.compiler-picker').value === 'monad-wasm-latest');
    await page.evaluate(() => window.monaco.editor.getModels().find(model => model.getLanguageId() === 'evm').setValue('60003560010160005200'));
    await page.waitForFunction(() => window.monaco.editor.getModels().some(model => model.getLanguageId() === 'asm' && model.getValue().includes('ContractEpilogue:')));
    await languagePicker.evaluate(select => select.tomselect.setValue('mevm'));
    await page.waitForFunction(() => document.querySelector('.lm_content select.compiler-picker').value === 'monad-mnemonic-latest' && window.monaco.editor.getModels().some(model => model.getLanguageId() === 'asm' && model.getValue().includes('ContractEpilogue:')));
    await page.waitForFunction(() => window.monaco.editor.getEditors().every(editor => !editor.getDomNode()?.offsetParent || Math.abs(editor.getLayoutInfo().width - editor.getDomNode().parentElement.clientWidth) < 5));
    const palette = await page.evaluate(() => ({
        header: getComputedStyle(document.querySelector('nav')).backgroundColor,
        wordmark: getComputedStyle(document.querySelector('.monad-brand')).color,
    }));
    assert.notEqual(palette.header, 'rgb(51, 51, 51)', 'Stock CE header colour remains');
    assert.equal(palette.wordmark, 'rgb(248, 237, 231)');
    assert.deepEqual(errors, []);
    assert.equal(requests.filter(request => request.method === 'POST').length, 0, 'Static site made a POST request');
    assert.match(requests.find(request => request.url.endsWith('mce-wasm.wasm'))?.url ?? '', /\/monad\/[0-9a-f]{16}\/mce-wasm\.wasm$/);
    assert.equal(requests.filter(request => !request.url.startsWith(new URL(url).origin)).length, 0, 'External runtime request');
    mkdirSync('out/monad', {recursive: true});
    await page.screenshot({path: 'out/monad/desktop.png', fullPage: true});
    await page.setViewportSize({width: 768, height: 1024});
    await page.waitForFunction(() => window.monaco.editor.getEditors().every(editor => !editor.getDomNode()?.offsetParent || Math.abs(editor.getLayoutInfo().width - editor.getDomNode().parentElement.clientWidth) < 5));
    await page.screenshot({path: 'out/monad/tablet.png', fullPage: true});
    console.log(`Browser checks passed at ${url}: mnemonics, x86, bytecode, JUMPI source highlighting, labels, errors, recovery, hex input and static-only requests.`);
} catch (error) {
    mkdirSync('out/monad', {recursive: true});
    await page?.screenshot({path: 'out/monad/failure.png', fullPage: true});
    console.error(await page?.evaluate(() => ({text: document.body.innerText.slice(0, 3000), models: window.monaco?.editor.getModels().map(m => ({language: m.getLanguageId(), value: m.getValue().slice(0, 400)}))})));
    throw error;
} finally {
    await browser.close();
}
