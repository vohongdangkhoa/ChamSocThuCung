"""Read-only checks for the verbatim PetNova deck.

Usage:
  python verify_pptx.py final.pptx
  python verify_pptx.py final.pptx --report qa_report.json

No OCR and no approximate text matching are used. Only whitespace is normalized.
Image equality is established by original bytes or decoded RGBA pixels.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import io
import json
import math
import posixpath
import re
import sys
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image


NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
R_EMBED = "{" + NS["r"] + "}embed"
R_ID = "{" + NS["r"] + "}id"


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def image_fingerprint(data: bytes) -> tuple[str, str | None, tuple[int, int] | None]:
    byte_hash = hashlib.sha256(data).hexdigest()
    try:
        with Image.open(io.BytesIO(data)) as im:
            im = im.convert("RGBA")
            dimensions = im.size
            digest = hashlib.sha256()
            digest.update(f"{im.width}x{im.height}:RGBA:".encode("ascii"))
            digest.update(im.tobytes())
            return byte_hash, digest.hexdigest(), dimensions
    except Exception:
        return byte_hash, None, None


def relationships(z: zipfile.ZipFile, part: str) -> dict[str, str]:
    relpath = posixpath.join(posixpath.dirname(part), "_rels", posixpath.basename(part) + ".rels")
    if relpath not in z.namelist():
        return {}
    result = {}
    for rel in ET.fromstring(z.read(relpath)):
        if rel.get("TargetMode") == "External":
            continue
        target = rel.get("Target", "")
        resolved = target.lstrip("/") if target.startswith("/") else posixpath.normpath(
            posixpath.join(posixpath.dirname(part), target)
        )
        result[rel.get("Id", "")] = resolved
    return result


def paragraph_text(p: ET.Element) -> str:
    parts = []
    for child in p:
        kind = child.tag.rsplit("}", 1)[-1]
        if kind == "br":
            parts.append("\n")
        elif kind in ("r", "fld"):
            parts.extend(t.text or "" for t in child.findall(".//a:t", NS))
    return "".join(parts)


def text_from_shape(shape: ET.Element) -> str:
    return "\n".join(paragraph_text(p) for p in shape.findall(".//a:p", NS))


def get_xfrm(element: ET.Element) -> ET.Element | None:
    for query in ("p:spPr/a:xfrm", "p:xfrm", "p:grpSpPr/a:xfrm"):
        item = element.find(query, NS)
        if item is not None:
            return item
    return None


def number(element: ET.Element | None, key: str, default: float = 0.0) -> float:
    return float(element.get(key, str(default))) if element is not None else default


def transformed_box(xfrm: ET.Element, parent: tuple[float, float, float, float]) -> list[float]:
    sx, sy, tx, ty = parent
    off, ext = xfrm.find("a:off", NS), xfrm.find("a:ext", NS)
    x, y, w, h = number(off, "x"), number(off, "y"), number(ext, "cx"), number(ext, "cy")
    rotation = float(xfrm.get("rot", "0")) / 60000.0 * math.pi / 180.0
    cos_r, sin_r = math.cos(rotation), math.sin(rotation)
    cx, cy = x + w / 2.0, y + h / 2.0
    points = []
    for px, py in ((x, y), (x + w, y), (x, y + h), (x + w, y + h)):
        dx, dy = px - cx, py - cy
        rx, ry = cx + cos_r * dx - sin_r * dy, cy + sin_r * dx + cos_r * dy
        points.append((rx * sx + tx, ry * sy + ty))
    return [min(p[0] for p in points), min(p[1] for p in points),
            max(p[0] for p in points), max(p[1] for p in points)]


def shape_records(tree: ET.Element, parent=(1.0, 1.0, 0.0, 0.0)):
    for element in tree:
        tag = element.tag.rsplit("}", 1)[-1]
        if tag not in ("sp", "pic", "graphicFrame", "grpSp", "cxnSp"):
            continue
        xfrm = get_xfrm(element)
        nv = element.find(".//p:cNvPr", NS)
        name = nv.get("name", "") if nv is not None else ""
        identifier = nv.get("id", "") if nv is not None else ""
        if tag == "grpSp":
            if xfrm is not None:
                off, ext = xfrm.find("a:off", NS), xfrm.find("a:ext", NS)
                choff, chext = xfrm.find("a:chOff", NS), xfrm.find("a:chExt", NS)
                cw, ch = number(chext, "cx", 1), number(chext, "cy", 1)
                gsx = number(ext, "cx", 1) / cw if cw else 1.0
                gsy = number(ext, "cy", 1) / ch if ch else 1.0
                psx, psy, ptx, pty = parent
                p = (psx * gsx, psy * gsy,
                     ptx + psx * (number(off, "x") - number(choff, "x") * gsx),
                     pty + psy * (number(off, "y") - number(choff, "y") * gsy))
            else:
                p = parent
            yield from shape_records(element, p)
            continue
        yield {
            "type": tag, "name": name, "id": identifier, "element": element,
            "box": transformed_box(xfrm, parent) if xfrm is not None else None,
            "raw_xfrm": xfrm,
            "text": text_from_shape(element),
        }


def read_slides(z: zipfile.ZipFile) -> tuple[list[dict], tuple[int, int]]:
    presentation = ET.fromstring(z.read("ppt/presentation.xml"))
    size = presentation.find("p:sldSz", NS)
    width, height = int(size.get("cx")), int(size.get("cy"))
    pres_rels = relationships(z, "ppt/presentation.xml")
    slide_parts = [pres_rels[s.get(R_ID)] for s in presentation.findall("p:sldIdLst/p:sldId", NS)]
    slides = []
    for index, part in enumerate(slide_parts, 1):
        root = ET.fromstring(z.read(part))
        records = list(shape_records(root.find("p:cSld/p:spTree", NS)))
        rels = relationships(z, part)
        pictures = []
        texts = []
        for shape in records:
            if normalized(shape["text"]):
                texts.append(shape)
            if shape["type"] != "pic":
                continue
            blip = shape["element"].find(".//a:blip", NS)
            media_part = rels.get(blip.get(R_EMBED)) if blip is not None else None
            crop = shape["element"].find(".//a:srcRect", NS)
            crop_values = {side: int(crop.get(side, "0")) for side in ("l", "t", "r", "b")} if crop is not None else {}
            pictures.append({
                "slide": index, "shape_id": shape["id"], "name": shape["name"],
                "media_part": media_part, "box": shape["box"],
                "crop": crop_values,
                "has_nonzero_crop": any(crop_values.values()),
            })
        reading_order = sorted(texts, key=lambda s: ((s["box"] or [0, 0])[1], (s["box"] or [0, 0])[0]))
        candidates = [normalized("\n".join(s["text"] for s in texts)),
                      normalized("\n".join(s["text"] for s in reading_order))]
        slides.append({"index": index, "part": part, "records": records,
                       "texts": texts, "text_candidates": candidates, "pictures": pictures})
    return slides, (width, height)


def main() -> int:
    base = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pptx", type=Path)
    parser.add_argument("--source", type=Path, default=base / "source_blocks.json")
    parser.add_argument("--media", type=Path, default=base / "media")
    default_plan = base / "rendered_plan.json"
    if not default_plan.exists():
        default_plan = base / "slide_plan.json"
    parser.add_argument("--plan", type=Path, default=default_plan)
    parser.add_argument("--report", type=Path, default=base / "pptx_verification.json")
    args = parser.parse_args()
    blocks = json.loads(args.source.read_text(encoding="utf-8-sig"))
    source_text = [b for b in blocks if b.get("type") == "paragraph" and normalized(b.get("text", ""))]
    plan = json.loads(args.plan.read_text(encoding="utf-8-sig")) if args.plan.exists() else None
    planned_slides = plan.get("slides", []) if isinstance(plan, dict) else (plan or [])
    block_to_planned_slide = {
        int(paragraph["block_id"]): int(slide["id"])
        for slide in planned_slides for paragraph in slide.get("paragraphs", [])
    }
    source_text_sequence = [int(b["id"]) for b in source_text]
    plan_text_sequence = [int(p["block_id"]) for s in planned_slides for p in s.get("paragraphs", [])]
    source_text_sequence_preserved = plan_text_sequence == source_text_sequence if planned_slides else None
    with zipfile.ZipFile(args.pptx) as z:
        slides, dimensions = read_slides(z)
        media = {}
        for name in z.namelist():
            if name.startswith("ppt/media/") and not name.endswith("/"):
                byte_hash, pixel_hash, size = image_fingerprint(z.read(name))
                media[name] = {"sha256": byte_hash, "pixel_sha256": pixel_hash, "dimensions": size}

        text_results = []
        for block in source_text:
            target = normalized(block["text"])
            matching = []
            for slide in slides:
                if any(target in candidate for candidate in slide["text_candidates"]) or any(
                    target in normalized(shape["text"]) for shape in slide["texts"]
                ):
                    matching.append(slide["index"])
            planned = block_to_planned_slide.get(block["id"])
            text_results.append({"block_id": block["id"], "characters": len(target),
                                 "matching_slides": matching, "planned_slide": planned,
                                 "present_as_native_text": bool(matching),
                                 "present_on_planned_slide": planned in matching if planned else None})

        placements = [p for slide in slides for p in slide["pictures"]]
        unconsumed = list(range(len(placements)))
        source_images = []
        for block in blocks:
            for relative in block.get("images", []):
                file = args.media / Path(relative).name
                byte_hash, pixel_hash, source_size = image_fingerprint(file.read_bytes())
                media_matches = [name for name, props in media.items() if props["sha256"] == byte_hash or
                                 (pixel_hash and props["pixel_sha256"] == pixel_hash)]
                available = [i for i in unconsumed if placements[i]["media_part"] in media_matches]
                chosen = available[0] if available else None
                if chosen is not None:
                    unconsumed.remove(chosen)
                placement = placements[chosen] if chosen is not None else None
                ratio_error = None
                if placement and placement["box"] and source_size:
                    box = placement["box"]
                    w, h = box[2] - box[0], box[3] - box[1]
                    if h:
                        ratio_error = abs((w / h) / (source_size[0] / source_size[1]) - 1)
                source_images.append({
                    "block_id": block["id"], "filename": file.name,
                    "source_sha256": byte_hash, "source_pixel_sha256": pixel_hash,
                    "source_dimensions": source_size, "matching_media_parts": media_matches,
                    "present_as_distinct_placement": placement is not None,
                    "placement": placement, "aspect_ratio_relative_error": ratio_error,
                })

        width, height = dimensions
        tolerance = 9144.0  # 0.01 inch, catches real off-canvas geometry without rounding noise.
        out_of_bounds = []
        for slide in slides:
            for shape in slide["records"]:
                box = shape["box"]
                if box and (box[0] < -tolerance or box[1] < -tolerance or box[2] > width + tolerance or box[3] > height + tolerance):
                    out_of_bounds.append({"slide": slide["index"], "shape_id": shape["id"],
                                          "name": shape["name"], "type": shape["type"], "box": box,
                                          "text_excerpt": normalized(shape["text"])[:100]})

        missing_text = [r for r in text_results if not r["present_as_native_text"]]
        wrong_slide = [r for r in text_results if r["planned_slide"] and not r["present_on_planned_slide"]]
        missing_images = [r for r in source_images if not r["present_as_distinct_placement"]]
        cropped = [r for r in source_images if r["placement"] and r["placement"]["has_nonzero_crop"]]
        distorted = [r for r in source_images if r["aspect_ratio_relative_error"] is not None and r["aspect_ratio_relative_error"] > 0.005]
        no_native_text_slides = [s["index"] for s in slides if not s["texts"]]
        slide_count_matches_plan = len(slides) == len(planned_slides) if planned_slides else None
        passed = not (missing_text or missing_images or cropped or distorted or out_of_bounds or wrong_slide) and slide_count_matches_plan is not False and source_text_sequence_preserved is not False
        report = {
            "status": "PASS" if passed else "FAIL",
            "pptx": str(args.pptx.resolve()), "source": str(args.source.resolve()),
            "plan": str(args.plan.resolve()),
            "normalization": "whitespace only; case, punctuation, words, numbers and diacritics unchanged",
            "slide_count": len(slides), "planned_slide_count": len(planned_slides) or None,
            "slide_count_matches_plan": slide_count_matches_plan,
            "source_text_sequence_preserved_in_plan": source_text_sequence_preserved,
            "slide_dimensions_emu": {"width": width, "height": height},
            "source_paragraphs": len(source_text), "native_paragraphs_covered": len(source_text) - len(missing_text),
            "source_image_occurrences": len(source_images), "source_images_covered": len(source_images) - len(missing_images),
            "picture_placements_total": len(placements), "embedded_media_count": len(media),
            "native_text_shape_count": sum(len(s["texts"]) for s in slides),
            "missing_text": missing_text, "text_not_on_planned_slide": wrong_slide,
            "missing_images": missing_images, "cropped_source_images": cropped,
            "distorted_source_images": distorted, "out_of_bounds_shapes": out_of_bounds,
            "slides_without_native_text": no_native_text_slides,
            "text_results": text_results, "image_results": source_images,
            "limitations": [
                "This checks PPTX XML, exact native text, embedded image bytes/pixels, source cropping and shape bounds.",
                "It does not establish visual text fit, line clipping inside text boxes, font rendering or contrast. Render inspection is still required.",
                "Existing clipping, ellipses, scrollbars or cropped edges already present in the source screenshots are preserved and cannot be reconstructed.",
            ],
        }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in (
        "status", "slide_count", "source_paragraphs", "native_paragraphs_covered", "source_image_occurrences",
        "source_images_covered", "picture_placements_total", "native_text_shape_count")}, ensure_ascii=False))
    print("Report:", args.report.resolve())
    if not passed:
        print(json.dumps({"missing_text_blocks": [r["block_id"] for r in missing_text],
                          "wrong_slide_blocks": [r["block_id"] for r in wrong_slide],
                          "missing_image_files": [r["filename"] for r in missing_images],
                          "cropped_images": [r["filename"] for r in cropped],
                          "distorted_images": [r["filename"] for r in distorted],
                          "out_of_bounds_count": len(out_of_bounds)}, ensure_ascii=False))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
