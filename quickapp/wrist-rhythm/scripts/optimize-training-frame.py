import sys
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1])
image = Image.open(source).convert('RGBA')
if source.name.startswith('breath-'):
    # This stage has a fixed opaque background. RGB quantization preserves
    # smooth low-opacity glow better than octree quantization of RGBA.
    backdrop = Image.new('RGBA', image.size, (8, 11, 16, 255))
    backdrop.alpha_composite(image)
    result = backdrop.convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT)
else:
    # The boxer overlays native rings, so its transparent margin is retained.
    result = image.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
result.save(source, format='PNG', optimize=True)
