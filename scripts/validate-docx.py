import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

DOCX_PATH = (
    Path(sys.argv[1])
    if len(sys.argv) > 1
    else Path("artifacts/phase-2/kemenag-depok-press-release-dummy.docx")
)
EXPECTED_RATIO = float(sys.argv[2]) if len(sys.argv) > 2 else (1600 / 900)
WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}
W = f"{{{WORD_NS}}}"

with ZipFile(DOCX_PATH) as archive:
    document_xml = archive.read("word/document.xml")

root = ET.fromstring(document_xml)
section = root.find(".//w:sectPr", NS)
assert section is not None

page_size = section.find("w:pgSz", NS)
page_margin = section.find("w:pgMar", NS)
assert page_size is not None
assert page_margin is not None
assert page_size.get(f"{W}w") == "11906"
assert page_size.get(f"{W}h") == "16838"
assert page_size.get(f"{W}orient") == "portrait"
assert page_margin.get(f"{W}top") == "1378"
assert page_margin.get(f"{W}bottom") == "278"
assert page_margin.get(f"{W}left") == "1418"
assert page_margin.get(f"{W}right") == "1418"
assert page_margin.get(f"{W}gutter") == "0"

paragraphs = root.findall(".//w:body/w:p", NS)
assert 5 <= len(paragraphs) <= 12

for paragraph in paragraphs:
    properties = paragraph.find("w:pPr", NS)
    assert properties is not None

    alignment = properties.find("w:jc", NS)
    spacing = properties.find("w:spacing", NS)
    assert alignment is not None
    assert spacing is not None
    # Paragraf foto (berisi w:drawing) center sesuai spec; sisanya justify.
    is_photo = paragraph.find(".//w:drawing", NS) is not None
    expected_alignment = "center" if is_photo else "both"
    assert alignment.get(f"{W}val") == expected_alignment, alignment.get(f"{W}val")
    assert spacing.get(f"{W}line") == "240"
    assert spacing.get(f"{W}lineRule") == "auto"
    assert spacing.get(f"{W}before") == "0"
    assert spacing.get(f"{W}after") == "160"

    # Run gambar tidak membawa rPr teks — hanya run teks yang dicek font/size.
    for run in paragraph.findall("w:r", NS):
        if run.find("w:t", NS) is None:
            continue

        run_properties = run.find("w:rPr", NS)
        assert run_properties is not None
        fonts = run_properties.find("w:rFonts", NS)
        size = run_properties.find("w:sz", NS)
        assert fonts is not None
        assert size is not None
        assert fonts.get(f"{W}ascii") == "Calibri"
        assert fonts.get(f"{W}hAnsi") == "Calibri"
        assert size.get(f"{W}val") == "24"
        assert run_properties.find("w:b", NS) is None

italic_paragraphs = [
    paragraph for paragraph in paragraphs if paragraph.find(".//w:i", NS) is not None
]
assert len(italic_paragraphs) >= 1

# Foto wajib center tepat setelah judul. Dimensi harus proporsional; fixture
# Fixture PNG 160x90 dirender maksimal 12 cm tanpa dipaksa menjadi tinggi 8 cm.
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
photo_paragraphs = [
    paragraph for paragraph in paragraphs if paragraph.find(".//w:drawing", NS) is not None
]
assert len(photo_paragraphs) == 1
assert paragraphs.index(photo_paragraphs[0]) == 1, "foto harus tepat di bawah judul"
extent = photo_paragraphs[0].find(f".//{{{A_NS}}}ext")
assert extent is not None
cx = int(extent.get("cx"))
cy = int(extent.get("cy"))
assert cx <= 4324350
assert cy <= 7200900
assert abs((cx / cy) - EXPECTED_RATIO) < 0.01, (cx, cy)

# Ordered blocks fixture: quote pertama, paragraf penjelas, quote kedua.
italic_indices = [paragraphs.index(paragraph) for paragraph in italic_paragraphs]
assert len(italic_indices) == 2
assert italic_indices[1] - italic_indices[0] == 2, italic_indices
assert paragraphs[italic_indices[0] + 1].find(".//w:i", NS) is None

print("Validasi XML DOCX V2 lulus: format, ordered blocks, italic, dan rasio foto sesuai spesifikasi.")
