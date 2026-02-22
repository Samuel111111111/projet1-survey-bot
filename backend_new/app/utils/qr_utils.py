"""
Utility functions for generating QR codes.

We use the ``qrcode`` library to create QR codes. The generated codes can
be returned as raw bytes or saved to a file. QR codes are useful for
sharing survey links easily in print or digital media.
"""

from __future__ import annotations

from io import BytesIO
from typing import List

import qrcode
from PIL import Image

# Note: We lazily import reportlab modules in functions that need them.


def generate_qr_image(data: str) -> Image.Image:
    """Generate a QR code image for the given data.

    Args:
        data: The string to encode in the QR code (e.g. a URL).

    Returns:
        A ``PIL.Image`` instance representing the QR code.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    # qrcode returns a wrapper object (e.g. qrcode.image.pil.PilImage).
    # ReportLab/ImageReader sometimes fails to read that wrapper directly.
    # We normalize to a real PIL.Image.Image instance.
    img = qr.make_image(fill_color="black", back_color="white")
    if hasattr(img, "get_image"):
        img = img.get_image()
    return img.convert("RGB")


def generate_qr_png_bytes(data: str) -> bytes:
    """Generate a QR code for the given data and return it as PNG bytes.

    Args:
        data: The string to encode in the QR code.

    Returns:
        PNG-encoded bytes of the QR code image.
    """
    img = generate_qr_image(data)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def save_qr_code(data: str, path: str) -> None:
    """Generate and save a QR code image to the given path.

    Args:
        data: The string to encode in the QR code.
        path: The filesystem path where the PNG should be saved.
    """
    img = generate_qr_image(data)
    img.save(path)


def generate_qr_sheet_pdf(
    survey_urls: List[str],
    title: str = "Survey QR Codes",
    subtitle: str = "Scannez pour participer",
    cta: str = "",
    per_page: int = 30,
    page_format: str = "A4",
) -> bytes:
    """Generate a PDF containing a grid of QR codes for the provided survey URLs.

    Each QR code is placed in a simple grid layout. Titles and subtitles
    appear at the top of each page, and an optional call‑to‑action appears
    beneath each QR code. The number of QR codes per page can be controlled
    with ``per_page``. The default layout produces three columns and as
    many rows as necessary.

    Args:
        survey_urls: A list of survey URLs to encode. If more URLs than
            ``per_page`` are provided, the function creates multiple pages.
        title: Text printed at the top of each page.
        subtitle: Text printed below the title.
        cta: Optional call‑to‑action printed under each QR code (e.g. "Scannez & gagnez").
        per_page: Maximum number of QR codes per page. The actual number of
            codes per page will be the nearest multiple of the number of columns.
        page_format: Page format as understood by reportlab ("A4" or "letter").

    Returns:
        A bytes object containing the PDF document.
    """
    # Reportlab imports are done here to avoid requiring them at module import
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import mm
    from reportlab.lib.utils import ImageReader

    # Choose page size
    page_size = A4 if page_format.lower() != "letter" else letter
    width, height = page_size

    # Define grid parameters
    columns = 3
    rows = max(1, per_page // columns)
    per_page_actual = columns * rows

    # Generate QR images for all URLs (normalized PIL images)
    qr_images: List[Image.Image] = [generate_qr_image(url) for url in survey_urls]

    # Set up PDF canvas
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=page_size)

    # Margins
    margin_x = 20 * mm
    margin_y = 20 * mm
    # Height reserved for page title and subtitle
    header_height = 30 * mm
    # Available area for QR grid
    grid_width = width - 2 * margin_x
    grid_height = height - 2 * margin_y - header_height
    cell_width = grid_width / columns
    cell_height = grid_height / rows

    def _to_imagereader(pil_img: Image.Image) -> ImageReader:
        """Convert a PIL image to a ReportLab ImageReader safely."""
        buf = BytesIO()
        pil_img.save(buf, format="PNG")
        buf.seek(0)
        return ImageReader(buf)

    def draw_page(qr_batch: List[Image.Image]) -> None:
        # Draw header
        y_cursor = height - margin_y
        c.setFont("Helvetica-Bold", 16)
        c.drawString(margin_x, y_cursor, title)
        y_cursor -= 8 * mm
        c.setFont("Helvetica", 12)
        c.drawString(margin_x, y_cursor, subtitle)
        # Adjust cursor for grid start (below header)
        base_y = height - margin_y - header_height
        # Draw each QR in the batch
        for index, img in enumerate(qr_batch):
            row = index // columns
            col = index % columns
            # Coordinates for this cell
            x = margin_x + col * cell_width
            y = base_y - (row + 1) * cell_height
            # Determine QR size (80% of the smaller cell dimension)
            qr_side = min(cell_width, cell_height - 12 * mm) * 0.8
            # Center QR within its cell
            qr_x = x + (cell_width - qr_side) / 2
            qr_y = y + (cell_height - 12 * mm - qr_side) / 2 + 12 * mm
            reader = _to_imagereader(img)
            c.drawImage(reader, qr_x, qr_y, qr_side, qr_side)
            # Draw CTA below QR if provided
            if cta:
                c.setFont("Helvetica", 9)
                text_y = y + 4 * mm
                c.drawCentredString(x + cell_width / 2, text_y, cta)
        # End of page
        c.showPage()

    # Process QR images in batches
    for i in range(0, len(qr_images), per_page_actual):
        batch = qr_images[i:i + per_page_actual]
        draw_page(batch)

    # Finalise PDF
    c.save()
    return buffer.getvalue()