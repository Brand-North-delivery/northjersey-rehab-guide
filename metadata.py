"""
Embeds XMP metadata into the featured images — the SOP's IPTC block, written as
an XMP packet in an APP1 JPEG segment. exiftool is not installed here and is not
required: XMP is the format Google, Adobe and every modern reader actually parse,
and Pillow will not clobber it because we write the segment ourselves.

Fields map to the SOP:
  Document Title   -> dc:title           (the text on the image)
  Author Title     -> photoshop:AuthorsPosition
  Description      -> dc:description     (expanded text)
  Keywords         -> dc:subject         (the alt tag)
  Copyright Status -> xmpRights:Marked
  Copyright Notice -> dc:rights
  Copyright URL    -> xmpRights:WebStatement
  Creator          -> dc:creator
  Contact          -> Iptc4xmpCore:CreatorContactInfo

    python metadata.py
"""
import io, json, os, struct
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "assets", "featured")
manifest = json.load(io.open(os.path.join(OUT, "manifest.json"), encoding="utf-8"))

BRAND = "Bergen County Recovers"
SITE = "https://bergencountydrugrehabs.com/"
RIGHTS = (
    "This image belongs to Bergen County Recovers. "
    "Background photography is licensed stock; the composite, typography and "
    "brand mark are the property of the publisher."
)

XMP_NS = b"http://ns.adobe.com/xap/1.0/\x00"


def packet(title, desc, keywords):
    kw = "".join("<rdf:li>%s</rdf:li>" % escape(k.strip()) for k in keywords.split(",") if k.strip())
    return f"""<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
    xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
    xmpRights:Marked="True"
    xmpRights:WebStatement="{escape(SITE)}"
    photoshop:AuthorsPosition="{escape(BRAND)}"
    photoshop:Credit="{escape(BRAND)}">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">{escape(title)}</rdf:li></rdf:Alt></dc:title>
   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">{escape(desc)}</rdf:li></rdf:Alt></dc:description>
   <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">{escape(RIGHTS)}</rdf:li></rdf:Alt></dc:rights>
   <dc:creator><rdf:Seq><rdf:li>{escape(BRAND)}</rdf:li></rdf:Seq></dc:creator>
   <dc:subject><rdf:Bag>{kw}</rdf:Bag></dc:subject>
   <Iptc4xmpCore:CreatorContactInfo
     Iptc4xmpCore:CiUrlWork="{escape(SITE)}"
     Iptc4xmpCore:CiAdrRegion="New Jersey"
     Iptc4xmpCore:CiAdrCtry="United States"/>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"""


def strip_existing_xmp(data):
    """Remove any APP1 XMP segment so repeat runs do not stack packets."""
    out, i = bytearray(data[:2]), 2
    while i < len(data) - 1:
        if data[i] != 0xFF:
            out.extend(data[i:]); break
        marker = data[i + 1]
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            out.extend(data[i:i + 2]); i += 2; continue
        if marker == 0xDA:
            out.extend(data[i:]); break
        seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
        seg = data[i:i + 2 + seg_len]
        if not (marker == 0xE1 and seg[4:4 + len(XMP_NS)] == XMP_NS):
            out.extend(seg)
        i += 2 + seg_len
    return bytes(out)


def embed(path, xmp):
    data = strip_existing_xmp(io.open(path, "rb").read())
    payload = XMP_NS + xmp.encode("utf-8")
    if len(payload) + 2 > 65535:
        raise ValueError("XMP packet too large for one APP1 segment")
    segment = b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload
    # insert immediately after SOI so readers find it first
    io.open(path, "wb").write(data[:2] + segment + data[2:])


count = 0
for slug, f in manifest.items():
    title = f["alt"]
    desc = f"{f['line1']}. {f['line2']}. Featured image for the {BRAND}, reviewed August 2026."
    keywords = f"{f['line1']}, {f['line2']}, Bergen County, addiction treatment, rehab comparison"
    xmp = packet(title, desc, keywords)
    for key in ("desktop", "mobile"):
        p = os.path.join(ROOT, f[key])
        embed(p, xmp)
        count += 1
    print(f"  {slug}")

print(f"\nXMP embedded in {count} files.")
