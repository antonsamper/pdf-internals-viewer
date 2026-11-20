Original project-owned PDFs encrypted with independent pypdf 6.14.2.

The script encrypts `public/samples/minimal.pdf`, so run `node scripts/fixtures/generate.mjs` first.
Then regenerate from the repository root with `python3 scripts/fixtures/generate-encrypted.py`
(requires `pypdf[crypto]==6.14.2`). Python is only a fixture-generation tool.

- `*-empty.pdf`: empty opening password, owner password `owner-secret`, copying restricted.
- `*-password.pdf`: opening password `secret`, owner password `owner-secret`.
- `AES-128-compressed.pdf`: opening password `secret`; encrypted Flate object stream
  appended with an incremental xref stream. Its contained dictionary has
  `/Message (Compressed secret)`. pypdf independently reads it back during generation.

The fixtures cover RC4 revisions 2/3, AES revision 4, and AES revision 6.
AES-256 fixtures use an unsigned `/P`, exercising the R6 `/Perms` comparison patch
in `scripts/prepare-parser.mjs`, which compares both values as signed 32-bit integers.
All non-compressed fixtures have one page and the title `Encrypted fixture title`.
Random encryption salts/IVs mean regeneration changes the bytes.
