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

function hexSourceLines(source) {
    const byteLines = [];
    const input = source.replace(/^(\s*)0x/i, '$1');
    let nibble = 0;
    for (const [index, line] of input.split('\n').entries()) {
        for (const char of line) {
            if (/\s/.test(char)) continue;
            if (nibble++ % 2 === 0) byteLines.push(index + 1);
        }
    }
    return byteLines;
}

export function assemblyLines(assembly, source, filters = {}, sourceLines = null) {
    const byteLines = sourceLines ?? hexSourceLines(source);
    let sourceLine = null;
    return assembly.split('\n').flatMap(text => {
        const match = text.match(/^\s*\/\/\s+0x([0-9a-f]+):\s*(.*)$/i);
        if (match) sourceLine = match[2] ? (byteLines[Number.parseInt(match[1], 16)] ?? null) : null;
        if (/^\s*\/\/\s+(?:FallThrough\b|Stop \(implicit\))/.test(text)) sourceLine = null;
        if (/^(ContractEpilogue:|Error:|\.section)/.test(text)) sourceLine = null;
        if (!text || (filters.commentOnly && text.trimStart().startsWith('//'))) return [];
        if (filters.directives && /^\s*(\.|align\s)/.test(text)) return [];
        return [{text, source: sourceLine ? {file: null, line: sourceLine} : null}];
    });
}

function bytecodeLines(bytecode, sourceLines) {
    const lines = [];
    for (let offset = 0; offset < bytecode.length / 2; ) {
        const opcode = Number.parseInt(bytecode.slice(offset * 2, offset * 2 + 2), 16);
        const size = 1 + (opcode >= 0x60 && opcode <= 0x7f ? opcode - 0x5f : 0);
        lines.push({
            text: bytecode.slice(offset * 2, (offset + size) * 2),
            source: {file: null, line: sourceLines[offset]},
        });
        offset += size;
    }
    return lines;
}

export async function compileRequest(modulePromise, request) {
    const start = performance.now();
    const bytecodeOutput = request.compiler === 'monad-bytecode';
    const mnemonic = bytecodeOutput || request.compiler.startsWith('monad-mnemonic-');
    const base = {
        timedOut: false,
        didExecute: false,
        stdout: [],
        stderr: [],
        tools: [],
        code: 0,
        okToCache: true,
        inputFilename: mnemonic ? 'example.mevm' : 'example.hex',
        languageId: 'asm',
        instructionSet: 'amd64',
    };
    try {
        const revision = bytecodeOutput ? 'latest' : request.compiler.replace(/^monad-(?:wasm|mnemonic)-/, '');
        if (!revisions.includes(revision)) throw new Error(`Unsupported compiler: ${request.compiler}`);
        if (request.options?.userArguments?.trim()) {
            throw new Error(
                'Use the compiler picker to select a revision. Additional compiler flags are not supported.',
            );
        }
        const module = await modulePromise;
        let hex = request.source;
        let sourceLines = null;
        if (mnemonic) {
            const assembled = module.assembleMnemonic(request.source);
            if (assembled.error) throw new Error(assembled.error);
            hex = assembled.bytecode;
            sourceLines = assembled.sourceLines;
            if (bytecodeOutput) {
                return {
                    ...base,
                    asm: bytecodeLines(hex, sourceLines),
                    asmSize: hex.length / 2,
                    languageId: 'evm',
                    instructionSet: 'evm',
                    execTime: performance.now() - start,
                };
            }
        }
        const result = module.compileHex(hex, revision);
        if (result.error) throw new Error(result.error);
        const asm = assemblyLines(result.assembly, request.source, request.options?.filters, sourceLines);
        return {...base, asm, execTime: performance.now() - start};
    } catch (error) {
        return {...base, code: 1, okToCache: false, asm: [], stderr: [{text: String(error.message ?? error)}]};
    }
}
