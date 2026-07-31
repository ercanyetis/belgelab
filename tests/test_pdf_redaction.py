import io
import json
import unittest

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

from server import app, create_secure_redacted_pdf, limiter, parse_redaction_areas


def make_pdf(*page_texts):
    output = io.BytesIO()
    document = canvas.Canvas(output, pagesize=(300, 400))
    for text in page_texts:
        document.setFont("Helvetica", 14)
        document.drawString(30, 320, text)
        document.drawString(30, 60, "KORUNACAK METIN")
        document.showPage()
    document.save()
    return output.getvalue()


class RedactionTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True, RATELIMIT_ENABLED=False)
        limiter.reset()
        self.client = app.test_client()

    def post(self, pdf_bytes, areas, filename="kişisel-belge.pdf"):
        response = self.client.post(
            "/api/pdf-redact",
            data={"file": (io.BytesIO(pdf_bytes), filename), "areas": json.dumps(areas)},
            content_type="multipart/form-data",
        )
        self.addCleanup(response.close)
        return response

    def test_output_has_no_extractable_source_text_or_annotations(self):
        source = make_pdf("GIZLI TC 12345678901", "GIZLI IBAN TR001234")
        response = self.post(source, [
            {"page": 1, "x": .05, "y": .12, "width": .8, "height": .18},
            {"page": 2, "x": .05, "y": .12, "width": .8, "height": .18},
        ])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "application/pdf")
        self.assertIn("sansurlenmis.pdf", response.headers["Content-Disposition"])
        reader = PdfReader(io.BytesIO(response.data), strict=False)
        self.assertEqual(len(reader.pages), 2)
        self.assertTrue(all((page.extract_text() or "") == "" for page in reader.pages))
        self.assertNotIn(b"GIZLI", response.data)
        self.assertNotIn(b"12345678901", response.data)
        self.assertNotIn(b"TR001234", response.data)
        for page in reader.pages:
            self.assertNotIn("/Annots", page)
            self.assertIn("/XObject", page["/Resources"].get_object())

    def test_helper_preserves_source_and_page_count(self):
        source = make_pdf("BIRINCI", "IKINCI")
        before = bytes(source)
        output = create_secure_redacted_pdf(source, {1: [(.1, .1, .2, .1)]})
        self.assertEqual(source, before)
        self.assertEqual(len(PdfReader(io.BytesIO(output)).pages), 2)

    def test_redaction_coordinates_produce_opaque_black_pixels(self):
        import pypdfium2 as pdfium
        response = self.post(make_pdf("GIZLI"), [{"page": 1, "x": .1, "y": .1, "width": .25, "height": .2}])
        document = pdfium.PdfDocument(response.data)
        page = document[0]
        bitmap = page.render(scale=1)
        image = bitmap.to_pil().convert("RGB")
        pixel = image.getpixel((round(image.width * .2), round(image.height * .2)))
        self.assertEqual(pixel, (0, 0, 0))
        image.close(); bitmap.close(); page.close(); document.close()

    def test_page_and_upload_limits_are_enforced(self):
        writer = PdfWriter()
        for _ in range(251):
            writer.add_blank_page(width=100, height=100)
        oversized_pages = io.BytesIO(); writer.write(oversized_pages)
        area = [{"page": 1, "x": .1, "y": .1, "width": .2, "height": .2}]
        response = self.post(oversized_pages.getvalue(), area)
        self.assertEqual(response.status_code, 400)
        self.assertIn("en fazla 250", response.get_json()["error"])
        response = self.post(b"%PDF-1.4\n" + b"0" * (17 * 1024 * 1024), area)
        self.assertEqual(response.status_code, 413)

    def test_multiple_areas_on_one_page(self):
        response = self.post(make_pdf("GIZLI"), [
            {"page": 1, "x": .1, "y": .1, "width": .2, "height": .1},
            {"page": 1, "x": .5, "y": .5, "width": .3, "height": .2},
        ])
        self.assertEqual(response.status_code, 200)

    def test_empty_list_is_rejected(self):
        response = self.post(make_pdf("GIZLI"), [])
        self.assertEqual(response.status_code, 400)
        self.assertIn("En az bir", response.get_json()["error"])

    def test_invalid_pages_and_coordinates_are_rejected(self):
        invalid = [
            {"page": 2, "x": .1, "y": .1, "width": .2, "height": .2},
            {"page": 1, "x": .9, "y": .1, "width": .2, "height": .2},
            {"page": 1, "x": -.1, "y": .1, "width": .2, "height": .2},
        ]
        for area in invalid:
            with self.subTest(area=area):
                self.assertEqual(self.post(make_pdf("GIZLI"), [area]).status_code, 400)

    def test_malformed_and_tiny_areas_are_rejected(self):
        response = self.client.post("/api/pdf-redact", data={"file": (io.BytesIO(make_pdf("GIZLI")), "a.pdf"), "areas": "{"}, content_type="multipart/form-data")
        self.assertEqual(response.status_code, 400)
        with self.assertRaisesRegex(ValueError, "çok küçük"):
            parse_redaction_areas(json.dumps([{"page": 1, "x": .1, "y": .1, "width": .001, "height": .2}]), 1)

    def test_invalid_and_encrypted_pdf_are_rejected(self):
        area = [{"page": 1, "x": .1, "y": .1, "width": .2, "height": .2}]
        self.assertEqual(self.post(b"not a pdf", area).status_code, 400)
        source = PdfReader(io.BytesIO(make_pdf("GIZLI")))
        writer = PdfWriter()
        writer.add_page(source.pages[0])
        writer.encrypt("secret")
        encrypted = io.BytesIO()
        writer.write(encrypted)
        response = self.post(encrypted.getvalue(), area)
        self.assertEqual(response.status_code, 400)
        self.assertIn("kilidini açın", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
