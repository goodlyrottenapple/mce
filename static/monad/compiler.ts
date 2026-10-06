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

import type {CompilationResult} from '../../types/compilation/compilation.interfaces.js';
import {options} from '../options.js';

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<
    number,
    {
        resolve: (result: CompilationResult) => void;
        reject: (error: Error) => void;
        timeout: ReturnType<typeof setTimeout>;
    }
>();

function resetWorker(error: Error) {
    worker?.terminate();
    worker = undefined;
    for (const job of pending.values()) {
        clearTimeout(job.timeout);
        job.reject(error);
    }
    pending.clear();
}

export function compileInBrowser(request: Record<string, any>): Promise<CompilationResult> {
    if (!worker) {
        worker = new Worker(`${window.staticRoot}${options.monadAssetsPath ?? 'monad/'}worker.mjs`, {type: 'module'});
        worker.onmessage = ({data}: MessageEvent<{id: number; result: CompilationResult}>) => {
            const job = pending.get(data.id);
            if (!job) return;
            clearTimeout(job.timeout);
            pending.delete(data.id);
            job.resolve(data.result);
        };
        worker.onerror = () => resetWorker(new Error('The compiler worker stopped. Compile again to restart it.'));
        worker.onmessageerror = () => resetWorker(new Error('Could not read the compiler response.'));
    }
    return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timeout = setTimeout(() => resetWorker(new Error('Compilation exceeded 30 seconds.')), 30000);
        pending.set(id, {resolve, reject, timeout});
        worker!.postMessage({id, source: request.source, compiler: request.compiler, options: request.options});
    });
}
