# Prepared additive release instructions — not executed

Proposed tag: `source-materials-2026-10-06`, targeting the reviewed final commit on `codex/runtime-source-materials-20261006` in the standalone `arvo-office-runtime` repository. Preserve all existing tags, source/runtime release assets and Cloudflare deployments.

Proposed assets:

- `arvo-office-corresponding-source-materials-20261006.zip`: full original pinned source/dependency/tool archives and component notices plus corrected instructions, manifest creation script, current readable adapter, source pages, tests and regenerated source inventory.
- `arvo-office-source-materials-static-20261006.zip`: 30-file static package assembled from the same four retained corrected raw engine outputs and current adapter. No proprietary parent, credentials or user documents.
- `SHA256SUMS`: exact SHA-256 and basename for both prepared ZIPs, generated after final source and static assembly. Do not insert the corrected source ZIP's own digest into files inside that ZIP; this would be circular. The existing original source digest remains pinned separately.

Before any publication, the release owner should inspect the final commit/diff, tests, prepared ZIP inventories/hashes and explicit unchanged engine/header proof. Root owns release and any hosting action. This document performs none.

Once explicitly approved, publish the new additive tag/release and verify anonymous source accessibility, asset size/digest and release target. Only after those links exist should a reviewed static update be published. Inspect its about/source links and current served hashes/MIME/security headers independently. Existing backend HTTP 403 does not prove the hosted bytes. A release/API digest alone does not establish the browser hosting layer.

Candidate SOURCE.md/about.html link both the unchanged `engine-2026-10-02` base source and the proposed corrected source asset. engine-provenance.json preserves original sourceURL/sourceSHA256 and adds sourceMaterialsURL/sourceMaterialsStatus. The prepared materials pointer is explicitly unpublished. The currently served deployment retains the original links until root performs and verifies a later update.

The manifest creation command checks retained pinned build outputs, not a fresh compiler run. A new engine build requires independently reviewed provenance; do not change existing pins to accept arbitrary bytes. This artifact preparation does not establish final legal compatibility or proprietary-parent separation.
