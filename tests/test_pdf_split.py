import io
import unittest
import zipfile

from pypdf import PdfReader, PdfWriter

from server import app, parse_split_ranges


def make_pdf(page_count: int) -> bytes:
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=595, height=842)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


class SplitRangeTests(unittest.TestCase):
    def test_multiple_ranges(self):
        self.assertEqual(
            parse_split_ranges("ranges", "1-3, 8-10, 15-18", "", 20),
            [(1, 3), (8, 10), (15, 18)],
        )

    def test_each_page(self):
        self.assertEqual(parse_split_ranges("each", "", "", 3), [(1, 1), (2, 2), (3, 3)])

    def test_chunk_ranges(self):
        self.assertEqual(parse_split_ranges("chunk", "", "5", 12), [(1, 5), (6, 10), (11, 12)])

    def test_rejects_overlapping_pages(self):
        with self.assertRaisesRegex(ValueError, "daha önce seçilmiş"):
            parse_split_ranges("ranges", "1-5,5-8", "", 10)

    def test_rejects_out_of_bounds_range(self):
        with self.assertRaisesRegex(ValueError, "belge sınırını aşıyor"):
            parse_split_ranges("ranges", "1-11", "", 10)


class SplitEndpointTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def split(self, mode: str, *, ranges: str = "", chunk_size: str = ""):
        response = self.client.post(
            "/api/pdf-tool",
            data={
                "file": (io.BytesIO(make_pdf(12)), "Rapor.pdf"),
                "operation": "split",
                "split_mode": mode,
                "ranges": ranges,
                "chunk_size": chunk_size,
            },
            content_type="multipart/form-data",
        )
        self.addCleanup(response.close)
        return response

    def assert_zip_parts(self, response, expected: dict[str, int]):
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "application/zip")
        with zipfile.ZipFile(io.BytesIO(response.data)) as archive:
            self.assertEqual(archive.namelist(), list(expected))
            for name, page_count in expected.items():
                self.assertEqual(len(PdfReader(io.BytesIO(archive.read(name))).pages), page_count)

    def test_multiple_ranges_return_named_zip_parts(self):
        response = self.split("ranges", ranges="1-3,8-10")
        self.assert_zip_parts(response, {"Rapor_001-003.pdf": 3, "Rapor_008-010.pdf": 3})

    def test_each_page_returns_one_pdf_per_page(self):
        response = self.split("each")
        self.assert_zip_parts(response, {f"Rapor_{page:03d}.pdf": 1 for page in range(1, 13)})

    def test_chunk_mode_returns_expected_parts(self):
        response = self.split("chunk", chunk_size="5")
        self.assert_zip_parts(
            response,
            {"Rapor_001-005.pdf": 5, "Rapor_006-010.pdf": 5, "Rapor_011-012.pdf": 2},
        )

    def test_single_range_returns_pdf(self):
        response = self.split("ranges", ranges="2-4")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "application/pdf")
        self.assertIn("Rapor_002-004.pdf", response.headers["Content-Disposition"])
        self.assertEqual(len(PdfReader(io.BytesIO(response.data)).pages), 3)

    def test_invalid_range_returns_clear_error(self):
        response = self.split("ranges", ranges="1-5,5-8")
        self.assertEqual(response.status_code, 400)
        self.assertIn("daha önce seçilmiş", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
