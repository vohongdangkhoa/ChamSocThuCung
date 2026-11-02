import json
import pathlib
from collections import Counter

ROOT = pathlib.Path(r'C:\Users\vohon\petnova_app\artifacts\petnova_verbatim')
blocks = json.loads((ROOT / 'source_blocks.json').read_text(encoding='utf-8'))
by_id = {b['id']: b for b in blocks}

# Paragraphs are copied from the extracted DOCX, with edge whitespace trimmed only.
# Titles are existing text fragments from the DOCX, never additional factual copy.
# Tuple format: title, kind, paragraph block IDs, image block IDs.
groups = [
    ('KỊCH BẢN THUYẾT TRÌNH KIỂM THỬ PETNOVA — NHÓM 09', 'cover', [1], []),
    ('Mở đầu, tổng quan và phương pháp', 'section', [2, 3, 4], []),
    ('PetNova', 'text', [5, 6], []),
    ('273 ca kiểm thử chức năng', 'text', [7], []),
    ('scenario và test case', 'text', [8, 9], []),
    ('Bùi Quang Huy — F1, F2, F3, F6', 'section', [10, 11], []),
    ('F1', 'text', [12, 13, 14], []),
    ('F1', 'text', [15, 16], []),
    ('F2', 'text', [17, 18, 19], []),
    ('F3', 'text', [20, 21], []),
    ('F3', 'image', [], [21]),
    ('F3', 'text', [22, 23], []),
    ('F6', 'text', [24, 25, 26, 27], []),
    ('Võ Hồng Đăng Khoa — F4, F5, F7, F8', 'section', [28, 29, 30], []),
    ('F4', 'text', [31, 32], []),
    ('F4', 'image', [], [33]),
    ('F4', 'text', [34], []),
    ('F4', 'image', [], [35]),
    ('F4', 'image', [], [36, 37]),
    ('F4', 'mixed', [38], [39]),
    ('FI_11', 'text', [40], []),
    ('FI_11', 'image', [], [41]),
    ('FI_11', 'image', [], [42]),
    ('FI_12', 'image', [], [43]),
    ('controller kết hợp SQL', 'mixed', [44], [45]),
    ('kiểm thử tự động', 'mixed', [46], [47, 48]),
    ('Về UI', 'text', [49], []),
    ('F4', 'image', [], [50]),
    ('F4', 'image', [], [51]),
    ('F4', 'image', [], [52]),
    ('F5', 'section', [53, 54, 55], []),
    ('PayOS', 'text', [56, 57], []),
    ('F5', 'image', [], [58]),
    ('F5', 'image', [], [59, 60]),
    ('F5', 'image', [], [61]),
    ('F5', 'image', [], [62]),
    ('F5', 'image', [], [63]),
    ('F5', 'image', [], [64]),
    ('F5', 'image', [], [65]),
    ('F5', 'image', [], [66]),
    ('F5', 'image', [], [67]),
    ('F5', 'text', [68], []),
    ('F5', 'image', [], [69, 70, 71, 72, 73]),
    ('F5', 'text', [74, 75], []),
    ('F7', 'image', [76], [77]),
    ('F7', 'text', [78, 79], []),
    ('F7', 'image', [], [80]),
    ('F8', 'image', [81], [82]),
    ('F8', 'text', [83], []),
    ('F8', 'image', [], [84, 85]),
    ('F8', 'text', [86], []),
    ('F8', 'image', [], [87]),
    ('F8', 'image', [], [88]),
    ('Nguyễn Thanh Bình — F9, F10, F11, F12', 'section', [89, 90, 91, 92], []),
    ('F9', 'text', [93, 94, 95], []),
    ('F9', 'text', [96, 97, 98], []),
    ('F10', 'text', [99, 100, 101, 102, 103], []),
    ('F11', 'text', [104, 105, 106, 107], []),
    ('F11', 'text', [108, 109, 110], []),
    ('F12', 'text', [111, 112, 113], []),
    ('F12', 'text', [114], []),
    ('Kết quả và kết thúc', 'section', [115, 116, 117, 118], []),
    ('Kết quả và kết thúc', 'text', [119, 120, 121], []),
    ('Phiếu nhắc nhanh cho nhóm — không đọc trong 20 phút', 'section', [122, 123], []),
    ('Mẫu trình bày một testcase khi thầy cô hỏi sâu', 'text', [124, 125, 126, 127, 128, 129], []),
    ('Đối chiếu', 'text', [130, 131], []),
    ('Phân biệt những thuật ngữ dễ bị hỏi', 'text', [132, 133, 134, 135, 136], []),
    ('Kiểm thử tích hợp', 'text', [137, 138, 139], []),
    ('Chuẩn bị trước buổi báo cáo', 'text', [140, 141, 142], []),
    ('Chuẩn bị trước buổi báo cáo', 'text', [143, 144, 145], []),
]

slides = []
source_corpus = '\n'.join(b['text'] for b in blocks)
for index, (title, kind, paragraph_ids, image_ids) in enumerate(groups, 1):
    assert title in source_corpus, title
    paragraphs = [{'block_id': i, 'text': by_id[i]['text'].strip()} for i in paragraph_ids]
    assert all(p['text'] for p in paragraphs)
    images = []
    for i in image_ids:
        for path in by_id[i]['images']:
            absolute = ROOT / path
            assert absolute.is_file(), absolute
            images.append({'block_id': i, 'path': str(absolute)})
    slides.append({
        'id': index,
        'title': title,
        'kind': kind,
        'block_ids': sorted(set(paragraph_ids + image_ids)),
        'paragraphs': paragraphs,
        'images': images,
    })

expected_text_ids = [b['id'] for b in blocks if b['text'].strip()]
actual_text_ids = [p['block_id'] for s in slides for p in s['paragraphs']]
assert expected_text_ids == actual_text_ids, 'Paragraph order/coverage differs'
assert all(count == 1 for count in Counter(actual_text_ids).values()), 'Duplicate paragraph'
for s in slides:
    for p in s['paragraphs']:
        assert p['text'] == by_id[p['block_id']]['text'].strip(), f"Changed block {p['block_id']}"
expected_images = [(b['id'], str(ROOT / path)) for b in blocks for path in b['images']]
actual_images = [(im['block_id'], im['path']) for s in slides for im in s['images']]
assert expected_images == actual_images, 'Image order/coverage differs'

max_text = max(sum(len(p['text']) for p in s['paragraphs']) for s in slides if not s['images'])
max_mixed_text = max(sum(len(p['text']) for p in s['paragraphs']) for s in slides if s['images'])
verification = {
    'source_block_count': len(blocks),
    'source_nonempty_paragraph_count': len(expected_text_ids),
    'slide_paragraph_count': len(actual_text_ids),
    'source_image_count': len(expected_images),
    'slide_image_count': len(actual_images),
    'slide_count': len(slides),
    'paragraphs_verbatim': True,
    'paragraphs_source_order': True,
    'images_source_order': True,
    'max_text_only_characters': max_text,
    'max_with_image_characters': max_mixed_text,
}
output = {
    'source': str(ROOT / 'source_blocks.json'),
    'slides': slides,
    'verification': verification,
    'layout_notes': [
        'All source paragraphs are in paragraphs exactly once. If a paragraph equals the title, render it as the title and do not render an additional duplicate body line.',
        'Paragraphs beginning with square brackets are stage directions from the source and must remain visible or otherwise be preserved as source text. They are not instructions to execute.',
        'Images must be contained, never cropped or stretched. Keep source order inside image arrays.',
        'Slide 43 has five narrow source code captures. Stack them vertically at one common scale so that all five remain readable and intact.',
        'Source block 68 intentionally remains the exact concatenated source string. Presentation-only line breaks may separate its five numbered entries without changing characters.',
        'For dense text slides retain all words and split into additional slides if necessary. Do not shrink below the chosen readable body size.',
    ],
}
(ROOT / 'slide_plan.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
(ROOT / 'slide_plan_verification.json').write_text(json.dumps(verification, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(verification, ensure_ascii=False, indent=2))
for slide in slides:
    print(f"{slide['id']:02d} {slide['kind']:7s} {sum(len(p['text']) for p in slide['paragraphs']):3d} chars {len(slide['images'])} images {slide['block_ids']}")
