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
import {test} from 'node:test';

import {assemblyLines, compileRequest, revisions} from '../public/monad/adapter.mjs';
import createMce from '../public/monad/mce-wasm.mjs';

const module = createMce();
const request = (source, revision = 'latest', options = {}) => ({source, compiler: `monad-wasm-${revision}`, options});

test('compiles real WASM for every revision', async () => {
    for (const revision of revisions) {
        const result = await compileRequest(module, request('60003560010160005200', revision));
        assert.equal(result.code, 0, JSON.stringify(result.stderr));
        assert.ok(result.asm.some(line => line.text === 'ContractEpilogue:'));
        assert.equal(result.didExecute, false);
        assert.equal(result.languageId, 'asm');
        assert.ok(result.asm.some(line => line.source?.line === 1));
    }
});

test('reports errors and remains usable afterwards', async () => {
    for (const input of [
        request('gg'),
        request('0'),
        request('00', 'unknown'),
        request('00', 'latest', {userArguments: '-O3'}),
    ]) {
        const result = await compileRequest(module, input);
        assert.equal(result.code, 1);
        assert.equal(result.okToCache, false);
        assert.ok(result.stderr[0].text.length > 0);
    }
    assert.equal((await compileRequest(module, request('00'))).code, 0);
});

test('maps EVM byte offsets to source lines while filtering comments', () => {
    const asm = '// 0x00: PUSH1 0x0\nmov rax, 0\n// 0x02: CALLDATALOAD\nmov rdi, rax\nContractEpilogue:\nret\n.db 0x00';
    const result = assemblyLines(asm, '0x60 00\n35', {commentOnly: true, directives: true});
    assert.deepEqual(
        result.map(line => line.source?.line ?? null),
        [1, 2, null, null],
    );
    assert.ok(result.every(line => !line.text.startsWith('//') && !line.text.startsWith('.db')));
});

test('module load failures become readable compiler errors', async () => {
    const result = await compileRequest(Promise.reject(new Error('Failed to load WASM')), request('00'));
    assert.equal(result.code, 1);
    assert.equal(result.stderr[0].text, 'Failed to load WASM');
});
