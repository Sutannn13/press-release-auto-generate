import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

import fitz
from pypdf import PdfReader


DEFAULT_REFERENCE = Path(
    r"C:\Users\Sutan Arlie Johan\Downloads\Kemenag Depok Lanjutkan GEBER MAS dengan Ziarah dan Tabur Bunga di TMP Kalimulya (1).pdf"
)
REFERENCE_PDF = Path(
    sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GEBER_REFERENCE_PDF", DEFAULT_REFERENCE)
)
GENERATED_DOCX = Path(
    sys.argv[2]
    if len(sys.argv) > 2
    else "artifacts/phase-2/kemenag-depok-press-release-dummy.docx"
)


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def assert_order(text: str, markers: list[str], label: str) -> None:
    positions = [text.find(marker) for marker in markers]
    assert all(position >= 0 for position in positions), (label, positions, markers)
    assert positions == sorted(positions), (label, positions, markers)


assert REFERENCE_PDF.is_file(), f"PDF acuan tidak ditemukan: {REFERENCE_PDF}"
assert GENERATED_DOCX.is_file(), f"DOCX hasil tidak ditemukan: {GENERATED_DOCX}"

pdf_text = normalized(
    "\n".join((page.extract_text() or "") for page in PdfReader(REFERENCE_PDF).pages)
)

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
with ZipFile(GENERATED_DOCX) as archive:
    document_root = ET.fromstring(archive.read("word/document.xml"))
docx_text = normalized(
    " ".join(
        "".join(node.text or "" for node in paragraph.findall(f".//{{{WORD_NS}}}t"))
        for paragraph in document_root.findall(f".//{{{WORD_NS}}}body/{{{WORD_NS}}}p")
    )
)

shared_facts = [
    "Kemenag Depok Lanjutkan GEBER MAS dengan Ziarah dan Tabur Bunga di TMP Kalimulya",
    "CILODONG (KEMENAG) –",
    "Kantor Kementerian Agama Kota Depok",
    "Taman Makam Pahlawan (TMP) Kalimulya, Kota Depok",
    "Senin (10/08/2026)",
    "jajaran Kementerian Agama Kota Depok",
    "upacara penghormatan",
    "prosesi tabur bunga",
    "Ziarah dan tabur bunga ini menjadi momentum",
    "Sebagai ASN Kementerian Agama",
    "Kontributor : Hari",
]
for fact in shared_facts:
    assert fact.casefold() in pdf_text.casefold(), f"Fakta tidak ditemukan di PDF: {fact}"
    assert fact.casefold() in docx_text.casefold(), f"Fakta tidak ditemukan di DOCX: {fact}"

assert_order(
    pdf_text,
    [
        "CILODONG (KEMENAG) –",
        '"Ziarah dan tabur bunga ini menjadi momentum',
        "H. Dede juga menekankan",
        '"Sebagai ASN Kementerian Agama',
        "Rangkaian kegiatan GEBER MAS",
        "Kontributor : Hari",
    ],
    "PDF",
)
assert_order(
    docx_text,
    [
        "CILODONG (KEMENAG) –",
        '"Ziarah dan tabur bunga ini menjadi momentum',
        "H. Dede Supriatna menekankan",
        '"Sebagai ASN Kementerian Agama',
        "Upacara ziarah dan tabur bunga",
        "Kontributor : Hari",
    ],
    "DOCX",
)

pdf_document = fitz.open(REFERENCE_PDF)
image_boxes = []
for page in pdf_document:
    for image in page.get_image_info(xrefs=True):
        box = fitz.Rect(image["bbox"])
        if box.width > 0 and box.height > 0:
            image_boxes.append(box)
assert image_boxes, "Foto tidak ditemukan di PDF acuan."
largest_pdf_image = max(image_boxes, key=lambda box: box.width * box.height)
pdf_ratio = largest_pdf_image.width / largest_pdf_image.height

extent = document_root.find(f".//{{{DRAWING_NS}}}ext")
assert extent is not None
docx_ratio = int(extent.get("cx")) / int(extent.get("cy"))
expected_ratio = 16 / 9
assert abs(pdf_ratio - expected_ratio) < 0.02, pdf_ratio
assert abs(docx_ratio - expected_ratio) < 0.01, docx_ratio

print(
    "Golden audit GEBER MAS lulus: urutan isi, dateline, fakta, dua kutipan berseling, "
    f"penutup, kontributor, dan rasio foto 16:9 (PDF={pdf_ratio:.3f}, DOCX={docx_ratio:.3f})."
)
