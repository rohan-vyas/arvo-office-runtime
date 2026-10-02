# Arvo standalone Office runtime

A separately hosted Writer, Calc and Impress browser engine built from pinned LibreOffice/ZetaOffice, Qt and Emscripten sources. The isolated adapter exchanges selected Office document bytes with a parent application. It receives no provider credentials and cannot choose provider URLs or save directly to Microsoft.

## Source and licensing

The combined standalone engine is distributed under GNU GPL version 3. Each component retains its original copyright, licence terms and exceptions; the bridge adapter and zetajs retain MIT notices. The full corresponding-source archive includes the exact engine/tool/dependency sources, changes, build instructions and component notices. Arvo's private parent application and user documents are not included here. This repository does not relicense that application.

- [GNU GPL version 3](COPYING)
- [Build instructions](BUILDING.md)
- [Source manifest](manifest.json)
- [Corresponding source and notices](https://github.com/rohan-vyas/arvo-office-runtime/releases/download/engine-2026-10-02/arvo-office-corresponding-source.zip)

This is a modified build, not an official LibreOffice, Qt or allotropia release. The compiler callback change makes the browser resize callback asynchronous. Other exact source patches cover Mac host-tool and WebAssembly build portability. All changes are provided in this repository and the source archive.

## Release and acceptance boundary

Engine build: 2 October 2026. Writer/Calc/Impress local edit/export tests passed for synthetic DOCX, XLSX and PPTX, including richer formatting/formula/chart/image cases with recorded export normalization. The first parent export limit is 4 MiB. This does not establish the complete Office feature set, production authentication, Microsoft write-back or every possible document's fidelity.

The source archive is 980,743,534 bytes, SHA-256 `efb209336d755367e5746353713443d38d60a2f501903282a1d5e31389972b3d`. The source manifest lists 403 files. Static assembly reproduced the candidate's 24 runtime assets/configuration/headers byte-for-byte. A second clean engine compilation has not been claimed.

No warranty is provided. See the applicable licences. All trademarks remain their owners' property.
