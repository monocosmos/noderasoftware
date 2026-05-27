from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"C:\Users\hfk47\Documents\noderasoftware")
PDF = ROOT / "docx-render" / "HotelOps_Komut_Egitim_Dokumani.pdf"
OUT_DIR = ROOT / "docx-render-pages"
CONTACT_DIR = ROOT / "docx-render-contact-sheets"
XPDF_BIN = ROOT / "tools" / "xpdf" / "xpdf-tools-win-4.04" / "bin64"


def reset_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    for child in path.iterdir():
        if child.is_file():
            child.unlink()


def make_contact_sheets(page_paths: list[Path]) -> None:
    reset_dir(CONTACT_DIR)
    font = ImageFont.load_default()
    pages_per_sheet = 3
    thumb_width = 720
    padding = 32
    label_height = 28

    for start in range(0, len(page_paths), pages_per_sheet):
        batch = page_paths[start : start + pages_per_sheet]
        thumbs: list[tuple[Image.Image, str]] = []
        for path in batch:
            img = Image.open(path).convert("RGB")
            ratio = thumb_width / img.width
            thumb = img.resize((thumb_width, round(img.height * ratio)), Image.Resampling.LANCZOS)
            thumbs.append((thumb, path.stem.replace("page-", "Sayfa ")))

        sheet_width = thumb_width + padding * 2
        sheet_height = padding + sum(t.height + label_height + padding for t, _ in thumbs)
        sheet = Image.new("RGB", (sheet_width, sheet_height), "white")
        draw = ImageDraw.Draw(sheet)

        y = padding
        for thumb, label in thumbs:
            draw.text((padding, y), label, fill=(40, 40, 40), font=font)
            y += label_height
            sheet.paste(thumb, (padding, y))
            draw.rectangle(
                [padding, y, padding + thumb.width - 1, y + thumb.height - 1],
                outline=(210, 210, 210),
                width=1,
            )
            y += thumb.height + padding

        sheet_no = start // pages_per_sheet + 1
        sheet.save(CONTACT_DIR / f"contact-{sheet_no:02d}.png", quality=95)


def main() -> None:
    reset_dir(OUT_DIR)
    root = OUT_DIR / "page"
    subprocess.run(
        [
            str(XPDF_BIN / "pdftopng.exe"),
            "-r",
            "120",
            str(PDF),
            str(root),
        ],
        check=True,
    )

    page_paths: list[Path] = []
    for index, src in enumerate(sorted(OUT_DIR.glob("page-*.png")), start=1):
        dst = OUT_DIR / f"page-{index:02d}.png"
        if src != dst:
            src.replace(dst)
        page_paths.append(dst)

    make_contact_sheets(page_paths)
    print(f"Rendered {len(page_paths)} pages")
    print(f"Pages: {OUT_DIR}")
    print(f"Contact sheets: {CONTACT_DIR}")


if __name__ == "__main__":
    main()
