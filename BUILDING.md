# Building the standalone Office runtime

This published source base contains public upstream sources, engine modifications and the isolated adapter only. It contains no proprietary Arvo parent, credentials or user documents. The separate runtime is intended for a GPL-3.0-or-later distribution with each component retaining its own notices. The pinned engine and corresponding-source archive were published on 2 October 2026. This additive assembly/materials update is prepared locally; it does not claim a fresh deployment or a legal review.

## Sources and modifications

Restore LibreOffice core efaf0670b4d055f838a2849becb10f08aa06a257, Qt5 3d440b7787f9b5ba15e5f8bcd7aef39b388f94fa, and Qtbase a320678c85ec8029d5394bcd673d4c208af1de3a from Sources. Restore Qtbase inside qt5/qtbase. Apply LibreOffice-core.patch at the core root and Qtbase.patch at qt5/qtbase. Install argon2-wasm-archiver.patch as core/external/argon2/wasm-archiver.patch. The empty Qt5.patch and SDK patch indicate no additional tracked changes in those repositories.

Install Emscripten SDK e566f7bdcc7735f44037911c24b87a58a3c93145 with the 3.1.65 toolchain release fdcf56c75a1d27fdff6525a7e03423595485ca19 for ARM64 macOS. Its compiler source is pinned to 7f8a05dd4e37cbd7ffde6d624f91fd545f7b52e3 and archived separately. Preserve the three installed metadata differences in Emscripten-installed-SDK-metadata.patch. Apply emscripten-asynchronous-callback.patch to the compiler root and run embuilder build --force libhtml5 before the final engine link.

Native tool versions: m4 1.4.19, autoconf 2.72, automake 1.16.5, GNU make 4.4.1, gperf 3.1 and pkgconf 2.3.0. Their source archives are included. Build each to a private prefix; use that prefix's bin first in PATH. Provide pkg-config using pkgconf. Source emsdk_env.sh in the task shell only. The observed build used Python 3.13.3 and Node 24.19.0. Native ARM helpers used the matching macOS 26.4 SDK; a different native SDK requires its own portability verification.

## Qt build

Run Qt's configure with an installation prefix of your choice:

```sh
./configure -opensource -confirm-license -xplatform wasm-emscripten -feature-thread -prefix "$office_qt_prefix" -nomake tests -nomake examples -no-pch 'QMAKE_CFLAGS+=-sSUPPORT_LONGJMP=wasm -sDYNAMIC_EXECUTION=0' 'QMAKE_CXXFLAGS+=-sSUPPORT_LONGJMP=wasm -sDYNAMIC_EXECUTION=0' 'QMAKE_LFLAGS+=-sDYNAMIC_EXECUTION=0'
make -j8
make install
```

Use the real GNU make installed to your prefix. Review the open-source licence before running the explicit confirmation flag; the WASM platform plugin is GPL-3.0-or-later/commercial. Set QT5DIR to the resulting Qt prefix for core.

## Core build

Use Sources/external-tarballs as the download cache. Every retained archive matches the pinned download.lst; the manifest lists hashes. Configure core:

```sh
./autogen.sh --with-distro=LibreOfficeWASM32 --with-wasm-module='calc impress writer' --without-java --disable-odk --disable-report-builder --disable-online-update --without-help --without-myspell-dicts --with-lang=en-US --with-parallelism=2
make -j8 PARALLELISM=8 PKG_CONFIG="$office_tool_prefix/bin/pkg-config" build
```

The completed build outputs soffice.js, soffice.wasm, soffice.data and soffice.data.js.metadata under core/instdir/program. Preserve their exact hashes before assembling a runtime. The placeholder soffice.worker.js is unused: this SDK uses soffice.js for pthread workers. Use the pinned zetajs source included here and the adapter directory. Keep config.js's parent origin exact; don't allow arbitrary origins or pass authentication/provider secrets to the runtime. The current first-release document export cap is 4 MiB.

The initial full source build and corrected callback relink completed successfully. Source patches restored byte-for-byte. The corrected engine and source were published on 2 October 2026. A second completely clean full rebuild has not been claimed; browser/provider acceptance is recorded separately.

## Create the assembly input manifest

Use the four **raw, uncompressed** outputs from the completed corrected build. Run:

```sh
node create-engine-manifest.mjs "$office_raw_runtime"
```

This checks all four lengths and SHA-256 hashes against `engine-provenance.json`, then exclusively creates `source-engine-manifest.json` in that directory. It refuses changed/missing outputs or an existing manifest. The retained receipt records the 2 October build; this operation does not claim a new build or bless different engine bytes. For a new compilation, independently record and review its provenance before changing these pins. Compressed hosting files are not raw build inputs.

## Static-host assembly

Use `package-runtime.mjs` with Node and the raw four engine outputs plus their `source-engine-manifest.json` receipt in the input directory. The receipt binds asset names, lengths, SHA-256 hashes and the completed build. The standalone adapter is copied from this source bundle.

```sh
node package-runtime.mjs "$office_raw_runtime" "$office_fresh_static_output"
```

The destination must not exist. The script emits the exact-parent `https://arvosystem.com` policy and intact `/arvo-office/` URL, compressed data and ten independently verified WASM parts. It adds no provider URLs, credentials or user documents. Rebuild it with an explicitly reviewed exact parent origin for another deployment; do not use wildcard framing. Engine source, component notices and build materials must accompany public distribution. This script does not enable Arvo’s authenticated editor gates.

The assembler includes `COPYING`, `NOTICE`, `LibreOffice-LICENSE.html`, `SOURCE.md`, and the about HTML/CSS pages automatically. It keeps component terms and the corresponding-source pointer. The ten WASM parts and compressed data retain the original engine pins. No vendor-binary correspondence is assumed.

Verify the actual retained raw inputs with `OFFICE_RAW_ENGINE_DIRECTORY="$office_raw_runtime" node --test tests/source-assembly.test.mjs`. The source archives and patches support a source rebuild/relink; no separate proprietary application object kit is supplied. This is an artifact statement, not a legal interpretation of all component obligations.
