# Monad Compiler Explorer

A static build of Compiler Explorer that compiles EVM mnemonics to bytecode or x86-64 assembly
with Monad's real compiler, running locally in a WebAssembly worker. The default
UI uses Monad purple, dark panels, and the Monad Compiler Explorer wordmark.

## Run locally

Use Node 22.23.1 or newer, CMake, Ninja, and Emscripten 6.0.11 (the tested SDK).
Activate Emscripten so `emcmake` and `emcc` are on `PATH`.

```sh
npm ci
npm run build:monad
npm run serve:monad
```

Open **http://127.0.0.1:10240/**. The preview server only serves files; compilation
happens in the browser. Select **EVM mnemonics** in the editor's language picker
and enter `.mevm` source. Choose **Monad x86-64 · LATEST** (or another revision)
for assembly, or **EVM bytecode** for hex output. Add a second compiler pane to
view both outputs side by side.

```text
// Return 42 in a 32-byte word
push 42
push 0
mstore
push 32
push 0
return
```

Mnemonics are case-insensitive and support decimal/hex constants, `PUSH` with
automatic sizing, `PUSH1`–`PUSH32`, `//` comments, and labels such as
`push .end jump jumpdest .end`. Errors include source line numbers. Bytecode
output has one instruction per line; concatenate the lines for continuous hex.
The mnemonic assembler uses native MCE's latest-stable instruction set; the
revision picker controls x86 compilation.

**EVM bytecode** in the language picker retains the original hex-input mode,
including whitespace and an optional `0x` prefix. Existing saved hex layouts
continue to work. Solidity source is not supported.

Edits compile automatically. CE's source/assembly highlighting, multiple compiler
panes, diff panes, local file loading/saving, and full share links remain available.
Execution, server-side tools, short-link storage, and external integrations are
outside this static build. Compilation runs in a worker with a 30-second timeout;
the next request restarts a failed worker.

After frontend-only changes, use `npm run build:monad:ui` to reuse the WASM build.
After compiler changes, use the full `npm run build:monad` command.

## Source pin

`vendor/monad` is a submodule of
[monad-crypto/monad](https://github.com/monad-crypto/monad/tree/sam/mce_wasm),
tracking `sam/mce_wasm` and pinned to
`23c13a5a126d43eacd372013617d0e4c9379b0ad`. This revision contains the assembly-only
WASM target. Initialise only the dependencies this target needs:

```sh
git submodule update --init vendor/monad
git -C vendor/monad submodule update --init \
    third_party/asmjit third_party/evmc third_party/ethash third_party/unordered_dense
```

The build records the source commit in `static/monad/build.json`, and the compiler
picker displays that revision. Runtime helper addresses in the assembly listing
are labelled placeholders; generated x86 code is never executed by this site.

## Static hosting / GitHub Pages

Upload the **contents of `dist-monad/`** to the host. `index.html`, the `static/`
folder, license files, and `.nojekyll` must stay together. All asset paths are
relative, so this also works at a project URL such as
`https://USER.github.io/monad-compiler-explorer/`.

No API server, proxy, cross-origin isolation headers, or third-party runtime
requests are required. The host should serve `.mjs` as JavaScript and `.wasm` as
`application/wasm`. `.github/workflows/monad-pages.yml` builds and tests the site on pushes to `main`
and pull requests. Successful `main` builds deploy to
**https://goodlyrottenapple.github.io/mce/**. The workflow can also be run manually.
In repository Settings → Pages, select **GitHub Actions** as the source.

CI checks out the pinned submodule and four required dependencies, installs
Emscripten 6.0.11 and Node 24.19.0, builds the real WASM module and frontend, then
runs adapter and Chromium tests under the `/mce/` URL prefix before deployment.
Upstream CE infrastructure workflows run only in the upstream organisation.

For a local subdirectory-hosting check:

```sh
PORT=10241 BASE_PATH=/monad-compiler-explorer/ npm run serve:monad
MCE_URL=http://127.0.0.1:10241/monad-compiler-explorer/ npm run test:monad:browser
```

## Tests

```sh
npm run ts-check
npm run lint-check
npm run test-min
npm run test:monad
npx playwright install chromium
npm run test:monad:browser  # with the static preview running
```

The adapter tests run the actual WASM module across all supported revisions and
check input errors, recovery, filtering, and source-line mappings. Browser tests
check compilation on load and after edits, error recovery, branding, screenshots,
and that no compilation POSTs or third-party requests occur.

The default `npm start` command still starts upstream CE's conventional server;
use `serve:monad` for this static version.

The colour palette follows [Monad's brand guidelines](https://assets.super.so/c5e2ef86-423b-454d-b72a-6ac424e8f035/files/c895f8d4-16d5-4c9a-8d35-f6e90d513082.pdf).
