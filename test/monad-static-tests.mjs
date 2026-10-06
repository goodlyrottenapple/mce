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

test('assembles mnemonic source to bytecode and identical x86 for every revision', async () => {
    const source = '// add two constants\npush1 1\nPUSH2 0x0002\nadd\nstop';
    const hex = '60016100020100';
    const bytecode = await compileRequest(module, {source, compiler: 'monad-bytecode'});
    assert.equal(bytecode.code, 0, JSON.stringify(bytecode.stderr));
    assert.equal(bytecode.asm.map(line => line.text).join(''), hex);
    assert.deepEqual(
        bytecode.asm.map(line => line.source.line),
        [2, 3, 4, 5],
    );
    assert.equal(bytecode.asmSize, 7);
    assert.equal(bytecode.languageId, 'evm');
    for (const revision of revisions) {
        const mnemonic = await compileRequest(module, {source, compiler: `monad-mnemonic-${revision}`});
        const binary = await compileRequest(module, request(hex, revision));
        assert.equal(mnemonic.code, 0, JSON.stringify(mnemonic.stderr));
        assert.deepEqual(
            mnemonic.asm.map(line => line.text),
            binary.asm.map(line => line.text),
        );
        assert.ok(mnemonic.asm.some(line => line.source?.line === 2));
    }
});

test('resolves labels and PUSH widths using the real mnemonic assembler', async () => {
    const mce = await module;
    for (const [source, expected] of [
        ['push 0 push 255 push 256', '5f60ff610100'],
        ['push .end jump jumpdest .end stop', '6003565b00'],
        ['jumpdest .start push .start jump', '5b5f56'],
        ['push32 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff stop', `7f${'ff'.repeat(32)}00`],
        ['// empty\n', ''],
        ['push\t42\r\nstop', '602a00'],
    ]) {
        const result = mce.assembleMnemonic(source);
        assert.equal(result.error, '', source);
        assert.equal(result.bytecode, expected, source);
        assert.equal(result.sourceLines.length, expected.length / 2);
    }
    const source = `push .end jump\n${'stop\n'.repeat(254)}jumpdest .end`;
    assert.ok(mce.assembleMnemonic(source).bytecode.startsWith('61010256'));
});

test('reports mnemonic errors with source lines and recovers without restarting WASM', async () => {
    for (const source of [
        'push1',
        'push1 256',
        'push33 1',
        'push1 -1',
        'push1 0xgg',
        'jumpdest .same jumpdest .same',
        'push .missing jump',
        'wat',
        '0xab',
        'push1 0; stop',
        '/',
        'stop\0add',
        'push 0x' + 'f'.repeat(65),
    ]) {
        const result = await compileRequest(module, {source: `// comment\n${source}`, compiler: 'monad-bytecode'});
        assert.equal(result.code, 1, source);
        assert.equal(result.okToCache, false, source);
        assert.ok(result.stderr[0].text.length > 0, source);
        if (!source.includes('\0')) assert.match(result.stderr[0].text, /Line 2:/, source);
    }
    const recovered = await compileRequest(module, {source: 'push 42 stop', compiler: 'monad-mnemonic-latest'});
    assert.equal(recovered.code, 0, JSON.stringify(recovered.stderr));
});

test('shows symbolic runtime calls when comments and directives are filtered', async () => {
    const result = await compileRequest(
        module,
        request('6000316000356001350460005200', 'latest', {
            filters: {commentOnly: true, directives: true},
        }),
    );
    assert.equal(result.code, 0, JSON.stringify(result.stderr));
    const text = result.asm.map(line => line.text).join('\n');
    assert.match(text, /^call qword ptr \[runtime_balance_ptr\]$/m);
    assert.match(text, /^call qword ptr \[runtime_udiv_ptr\]$/m);
    assert.match(text, /^call qword ptr \[monad_vm_runtime_increase_memory_raw_v1_ptr\]$/m);
    assert.match(text, /^call qword ptr \[monad_vm_runtime_load_bounded_le_raw_ptr\]$/m);
    assert.doesNotMatch(text, /^call qword ptr \[ROD/m);
    assert.doesNotMatch(text, /^\/\//m);
});
