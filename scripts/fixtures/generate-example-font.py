"""Original geometric H glyph. Optional regeneration requires fonttools 4.63.0.
The checked-in TTF is consumed by the Node sample generator.
"""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

builder = FontBuilder(1000, isTTF=True)
builder.setupGlyphOrder(['.notdef', 'H'])
builder.setupCharacterMap({72: 'H'})
empty = TTGlyphPen(None)
pen = TTGlyphPen(None)
# Three original rectangles; clockwise contours, no overlaps.
for left, bottom, right, top in [(50, 0, 150, 700), (450, 0, 550, 700), (150, 300, 450, 400)]:
    pen.moveTo((left, bottom))
    pen.lineTo((left, top))
    pen.lineTo((right, top))
    pen.lineTo((right, bottom))
    pen.closePath()
builder.setupGlyf({'.notdef': empty.glyph(), 'H': pen.glyph()})
builder.setupHorizontalMetrics({'.notdef': (600, 0), 'H': (600, 50)})
builder.setupHorizontalHeader(ascent=800, descent=-200)
builder.setupNameTable({'familyName': 'ExampleMark', 'styleName': 'Regular', 'uniqueFontIdentifier': 'PDFInternalsExampleMark', 'fullName': 'ExampleMark Regular', 'psName': 'ExampleMark', 'version': 'Version 1.0'})
builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200, fsType=0)
builder.setupPost()
builder.setupMaxp()
builder.font['head'].created = 2082844800  # Fixed 1970 timestamp in the TrueType epoch.
builder.font['head'].modified = 2082844800
builder.font.recalcTimestamp = False
builder.save(Path(__file__).parent / 'assets' / 'example-mark.ttf')
