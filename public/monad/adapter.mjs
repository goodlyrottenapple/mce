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

export const revisions = [
    'latest',
    'berlin',
    'london',
    'paris',
    'shanghai',
    'cancun',
    'prague',
    'osaka',
    'amsterdam',
    ...['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'next'].map(
        revision => `monad_${revision}`,
    ),
];

export function assemblyLines(assembly, source, filters = {}) {
    const byteLines = [];
    const input = source.replace(/^(\s*)0x/i, '$1');
    let nibble = 0;
    for (const [index, line] of input.split('\n').entries()) {
        for (const char of line) {
            if (/\s/.test(char)) continue;
            if (nibble++ % 2 === 0) byteLines.push(index + 1);
        }
    }
    let sourceLine = null;
    return assembly.split('\n').flatMap(text => {
        const match = text.match(/^\s*\/\/\s+0x([0-9a-f]+):/i);
        if (match) sourceLine = byteLines[Number.parseInt(match[1], 16)] ?? null;
        if (/^(ContractEpilogue:|Error:|\.section)/.test(text)) sourceLine = null;
        if (!text || (filters.commentOnly && text.trimStart().startsWith('//'))) return [];
        if (filters.directives && /^\s*(\.|align\s)/.test(text)) return [];
        return [{text, source: sourceLine ? {file: null, line: sourceLine} : null}];
    });
}

export async function compileRequest(modulePromise, request) {
    const start = performance.now();
    const base = {
        timedOut: false,
        didExecute: false,
        stdout: [],
        stderr: [],
        tools: [],
        code: 0,
        okToCache: true,
        inputFilename: 'example.hex',
        languageId: 'asm',
        instructionSet: 'amd64',
    };
    try {
        const revision = request.compiler.replace(/^monad-wasm-/, '');
        if (!revisions.includes(revision)) throw new Error(`Unsupported compiler: ${request.compiler}`);
        if (request.options?.userArguments?.trim()) {
            throw new Error(
                'Use the compiler picker to select a revision. Additional compiler flags are not supported.',
            );
        }
        const module = await modulePromise;
        const result = module.compileHex(request.source, revision);
        if (result.error) throw new Error(result.error);
        const asm = assemblyLines(result.assembly, request.source, request.options?.filters);
        return {...base, asm, execTime: performance.now() - start};
    } catch (error) {
        return {...base, code: 1, okToCache: false, asm: [], stderr: [{text: String(error.message ?? error)}]};
    }
}
