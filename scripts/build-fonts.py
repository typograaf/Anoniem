"""Builds the WOFF2 web fonts from the TTF originals.

Two deliberate choices, both measured by screenshotting /aanbod at 1440x900 and
diffing the text against the original TTF:

  * The `wdth` axis is pinned to 100. Its range is 50-100 with a default of
    100, the site never varies width, and `font-stretch` computes to 100%
    everywhere -- so the outlines at the default instance are byte-identical
    and the rendering is pixel-identical. 1000 KB -> 230 KB.

  * Glyphs are NOT subset. A Latin subset saves another 29 KB but shifts glyph
    positioning enough to change 3.2% of the pixels in a block of body text
    (max channel delta 166). Tried with `retain_gids` to keep GPOS lookups
    pointing at the same glyph ids -- same 3.2%. Not worth it for 29 KB on an
    asset that is immutable-cached for a year.

`wght` and `opsz` stay variable: the site renders headings at 120px and body at
10px, and font-optical-sizing defaults to auto, so opsz is genuinely in use.

Needs `pip install fonttools brotli`; run only when the source TTFs change.
"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONTS = 'public/fonts'


def build(name, pin=None):
    src = f'{FONTS}/{name}.ttf'
    dst = f'{FONTS}/{name}.woff2'
    font = instancer.instantiateVariableFont(TTFont(src), pin, inplace=False) if pin else TTFont(src)
    font.flavor = 'woff2'
    font.save(dst)
    a, b = os.path.getsize(src), os.path.getsize(dst)
    print(f'{name}: {a/1024:.0f} KB -> {b/1024:.0f} KB ({100 - b/a*100:.0f}% smaller)')


build('HelveticaNowVar', {'wdth': 100})
build('NeueHaasUnica-Regular')
