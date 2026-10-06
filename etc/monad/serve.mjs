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

import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';

const root = resolve('dist-monad');
const port = Number(process.env.PORT ?? 10240);
const prefix = process.env.BASE_PATH ?? '/';
const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        if (!pathname.startsWith(prefix)) throw new Error('Not found');
        let file = resolve(root, pathname.slice(prefix.length) || 'index.html');
        if (file !== root && !file.startsWith(root + sep)) throw new Error('Not found');
        if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
        response.writeHead(200, {'Content-Type': types[extname(file)] ?? 'application/octet-stream'});
        createReadStream(file).pipe(response);
    } catch {
        response.writeHead(404); response.end('Not found');
    }
}).listen(port, '127.0.0.1', () => console.log(`Monad Compiler Explorer: http://127.0.0.1:${port}${prefix}`));
