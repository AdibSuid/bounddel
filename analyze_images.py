#!/usr/bin/env python3
"""
Compare images to understand why only one generates boundaries
"""

import os
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt

def analyze_image(tif_path):
    """Analyze what the model sees"""
    print(f"\n{'='*70}")
    print(f"Analyzing: {os.path.basename(tif_path)}")
    print('='*70)
    
    with rasterio.open(tif_path) as src:
        print(f"CRS: {src.crs}")
        print(f"Bounds: {src.bounds}")
        print(f"Shape: {src.shape}")
        
        # Read RGB
        if src.crs and src.crs.to_string() != 'EPSG:4326':
            print("Reprojecting...")
            dst_crs = 'EPSG:4326'
            transform, width, height = calculate_default_transform(
                src.crs, dst_crs, src.width, src.height, *src.bounds
            )
            
            rgb_bands = []
            for i in range(1, min(4, src.count + 1)):
                band = np.zeros((height, width), dtype=src.dtypes[0])
                reproject(
                    source=rasterio.band(src, i),
                    destination=band,
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=dst_crs,
                    resampling=Resampling.bilinear
                )
                rgb_bands.append(band)
        else:
            rgb_bands = [src.read(i) for i in range(1, min(4, src.count + 1))]
        
        # Stack to RGB
        if len(rgb_bands) == 1:
            rgb = np.stack([rgb_bands[0], rgb_bands[0], rgb_bands[0]], axis=-1)
        else:
            rgb = np.stack(rgb_bands[:3], axis=-1)
        
        # Normalize
        if rgb.dtype in [np.float32, np.float64]:
            rgb = np.clip(rgb * 255, 0, 255).astype(np.uint8)
        elif rgb.max() > 255:
            rgb = ((rgb - rgb.min()) / (rgb.max() - rgb.min()) * 255).astype(np.uint8)
        else:
            rgb = rgb.astype(np.uint8)
        
        print(f"RGB shape: {rgb.shape}")
        print(f"Value range: {rgb.min()} - {rgb.max()}")
        print(f"Mean values: R={rgb[:,:,0].mean():.1f}, G={rgb[:,:,1].mean():.1f}, B={rgb[:,:,2].mean():.1f}")
        
        # Check variance (indicates texture/detail)
        r_var = rgb[:,:,0].var()
        g_var = rgb[:,:,1].var()
        b_var = rgb[:,:,2].var()
        total_var = (r_var + g_var + b_var) / 3
        print(f"Variance: R={r_var:.1f}, G={g_var:.1f}, B={b_var:.1f}, Avg={total_var:.1f}")
        
        if total_var < 100:
            print("⚠️  LOW VARIANCE - Image may be too uniform/flat")
        
        # Save thumbnail for visual inspection
        img = Image.fromarray(rgb)
        thumbnail_path = f"/tmp/{os.path.basename(tif_path).replace('.tif', '_thumb.png')}"
        img.thumbnail((400, 400))
        img.save(thumbnail_path)
        print(f"Thumbnail saved: {thumbnail_path}")
        
        return rgb

# Test the working one and a non-working one
files = [
    '/home/kambing/Downloads/s2_aoi3_2024-10-04.tif',  # WORKS - 810 fields
    '/home/kambing/Downloads/s2_aoi1_2024-01-01.tif',  # FAILS - 0 fields
]

for f in files:
    if os.path.exists(f):
        analyze_image(f)

print("\n" + "="*70)
print("Check /tmp/*_thumb.png to see what the images look like")
print("="*70)
