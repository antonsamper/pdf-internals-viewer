"""Regenerate original encryption fixtures with independent pypdf 6.14.2.
Requires pypdf[crypto]. Only fixture generation uses Python, never the app.
Run after: node scripts/fixtures/generate.mjs
"""
from pathlib import Path
from io import BytesIO
import re
import zlib
from pypdf.generic import EncodedStreamObject, NameObject, NumberObject
from pypdf import PdfReader, PdfWriter, __version__

assert __version__ == "6.14.2", "Use pinned pypdf 6.14.2 for these fixtures"

root = Path(__file__).resolve().parents[2]
for algorithm in ("RC4-40", "RC4-128", "AES-128", "AES-256"):
    for password in ("", "secret"):
        writer = PdfWriter(clone_from=PdfReader(root / "public/samples/minimal.pdf"))
        writer.add_metadata({"/Title": "Encrypted fixture title"})
        writer.encrypt(password, "owner-secret", algorithm=algorithm,
                       permissions_flag=4294967292 if password else 4294967276)
        name = f"{algorithm}-{'password' if password else 'empty'}.pdf"
        target = root / "tests/fixtures/encryption" / name
        writer.write(target)
        reader = PdfReader(target)
        assert reader.decrypt(password)
        assert len(reader.pages) == 1
        assert reader.metadata.title == "Encrypted fixture title"
        owner = PdfReader(target)
        assert owner.decrypt("owner-secret")

# Append an independently encrypted /ObjStm and an unencrypted incremental xref
# stream. This exercises compressed-object decryption and provenance together.
writer = PdfWriter(clone_from=PdfReader(root / "public/samples/minimal.pdf"))
writer.encrypt("secret", "owner-secret", algorithm="AES-128")
base = BytesIO()
writer.write(base)
data = base.getvalue()
previous = int(re.search(rb"startxref\s+(\d+)\s+%%EOF", data).group(1))
container = EncodedStreamObject()
container.update({NameObject("/Type"): NameObject("/ObjStm"), NameObject("/Filter"): NameObject("/FlateDecode"), NameObject("/N"): NumberObject(1), NameObject("/First"): NumberObject(4)})
# Find unused IDs rather than relying on writer internals for existing objects.
first = len(writer._objects) + 1
assert first == 7  # Minimal input has 5 objects plus the encryption dictionary.
# Object-stream header refers to its compressed object's actual object number.
container._data = zlib.compress(f"{first + 1} 0 << /Message (Compressed secret) >>".encode())
out = BytesIO(data)
out.seek(0, 2)
container_offset = out.tell()
out.write(f"{first} 0 obj\n".encode())
writer._encryption.encrypt_object(container, first, 0).write_to_stream(out)
out.write(b"\nendobj\n")
xref_offset = out.tell()
entries = b"".join(bytes([kind]) + value.to_bytes(4, "big") + index.to_bytes(2, "big") for kind, value, index in ((1, container_offset, 0), (2, first, 0), (1, xref_offset, 0)))
ids = BytesIO()
writer._ID.write_to_stream(ids)
out.write(f"{first + 2} 0 obj\n<< /Type /XRef /Size {first + 3} /W [1 4 2] /Index [{first} 3] /Prev {previous} /Root 1 0 R /Encrypt {first - 1} 0 R /ID ".encode() + ids.getvalue() + f" /Length {len(entries)} >>\nstream\n".encode() + entries + f"\nendstream\nendobj\nstartxref\n{xref_offset}\n%%EOF\n".encode())
(root / "tests/fixtures/encryption/AES-128-compressed.pdf").write_bytes(out.getvalue())
reader = PdfReader(BytesIO(out.getvalue()))
assert reader.decrypt("secret")
assert reader.get_object(first + 1)["/Message"] == "Compressed secret"
