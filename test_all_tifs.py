#!/usr/bin/env python3
"""
Test all .tif files in Downloads folder with the backend
"""

import os
import sys
import base64
import json
import requests
from io import BytesIO
from PIL import Image
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
import numpy as np

def process_geotiff(tif_path):
    """Process GeoTIFF with reprojection to EPSG:4326 if needed"""
    print(f"\n{'='*70}")
    print(f"Processing: {os.path.basename(tif_path)}")
    print('='*70)
    
    with rasterio.open(tif_path) as src:
        print(f"Original CRS: {src.crs}")
        print(f"Original bounds: {src.bounds}")
        print(f"Shape: {src.shape}")
        print(f"Dtype: {src.dtypes[0]}")
        print(f"Bands: {src.count}")
        
        # Check if reprojection is needed
        if src.crs is None:
            print("⚠️  WARNING: No CRS found in file!")
            return None
        
        if src.crs.to_string() != 'EPSG:4326':
            print(f"🔄 Reprojecting from {src.crs} to EPSG:4326...")
            
            # Calculate transform to EPSG:4326
            dst_crs = 'EPSG:4326'
            transform, width, height = calculate_default_transform(
                src.crs, dst_crs, src.width, src.height, *src.bounds
            )
            
            # Create output array
            kwargs = src.meta.copy()
            kwargs.update({
                'crs': dst_crs,
                'transform': transform,
                'width': width,
                'height': height
            })
            
            # Reproject each band
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
            
            # Get reprojected bounds
            from rasterio.transform import array_bounds
            final_bounds = array_bounds(height, width, transform)
            print(f"Reprojected bounds: {final_bounds}")
            print(f"Reprojected shape: ({height}, {width})")
            
        else:
            print("✓ Already in EPSG:4326")
            rgb_bands = [src.read(i) for i in range(1, min(4, src.count + 1))]
            final_bounds = src.bounds
            height, width = src.shape
        
        # Stack to RGB
        if len(rgb_bands) == 1:
            rgb = np.stack([rgb_bands[0], rgb_bands[0], rgb_bands[0]], axis=-1)
        else:
            rgb = np.stack(rgb_bands[:3], axis=-1)
        
        # Normalize to uint8
        if rgb.dtype in [np.float32, np.float64]:
            print("Converting float to uint8...")
            rgb = np.clip(rgb * 255, 0, 255).astype(np.uint8)
        elif rgb.max() > 255:
            print(f"Normalizing values (range: {rgb.min()}-{rgb.max()})...")
            rgb = ((rgb - rgb.min()) / (rgb.max() - rgb.min()) * 255).astype(np.uint8)
        else:
            rgb = rgb.astype(np.uint8)
        
        print(f"Final RGB shape: {rgb.shape}, dtype: {rgb.dtype}")
        print(f"Value range: {rgb.min()} to {rgb.max()}")
        
        # Check if image is mostly black/empty
        non_zero = np.count_nonzero(rgb)
        total = rgb.size
        pct = (non_zero / total) * 100
        print(f"Non-zero pixels: {non_zero}/{total} ({pct:.1f}%)")
        
        if pct < 1:
            print("⚠️  WARNING: Image appears mostly empty/black!")
        
        # Create PNG data URL
        img = Image.fromarray(rgb)
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        png_data = buffer.getvalue()
        data_url = f"data:image/png;base64,{base64.b64encode(png_data).decode()}"
        
        # Bounds in [[south, west], [north, east]] format
        bbox = [[final_bounds[1], final_bounds[0]], [final_bounds[3], final_bounds[2]]]
        
        print(f"Bbox for backend: {bbox}")
        
        return data_url, bbox

def test_inference(filename, data_url, bbox):
    """Test inference with backend"""
    print(f"\n🔮 Testing inference...")
    
    payload = {
        "bbox": bbox,
        "modelId": "delineate-v1",
        "imageData": data_url
    }
    
    try:
        response = requests.post(
            'http://localhost:8000/infer',
            json=payload,
            timeout=120
        )
        
        if response.ok:
            result = response.json()
            field_count = result.get('metadata', {}).get('fieldCount', 0)
            proc_time = result.get('metadata', {}).get('processingTime', 0)
            confidence = result.get('metadata', {}).get('confidence', 0)
            
            print(f"✅ Status: {response.status_code}")
            print(f"   Fields: {field_count}")
            print(f"   Time: {proc_time}ms ({proc_time/1000:.1f}s)")
            print(f"   Confidence: {confidence}")
            
            return field_count > 0
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def main():
    downloads_dir = '/home/kambing/Downloads'
    
    # Find all .tif files
    tif_files = []
    for root, dirs, files in os.walk(downloads_dir):
        for file in files:
            if file.lower().endswith(('.tif', '.tiff')):
                tif_files.append(os.path.join(root, file))
    
    print(f"Found {len(tif_files)} .tif files in {downloads_dir}")
    
    if len(tif_files) == 0:
        print("No .tif files found!")
        return
    
    # Test each file
    results = []
    for tif_path in tif_files[:10]:  # Test first 10 files
        try:
            result = process_geotiff(tif_path)
            if result:
                data_url, bbox = result
                success = test_inference(os.path.basename(tif_path), data_url, bbox)
                results.append((os.path.basename(tif_path), success))
            else:
                results.append((os.path.basename(tif_path), False))
        except Exception as e:
            print(f"❌ Error processing {os.path.basename(tif_path)}: {e}")
            results.append((os.path.basename(tif_path), False))
    
    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY")
    print('='*70)
    for filename, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {filename}")
    
    passed = sum(1 for _, s in results if s)
    print(f"\nTotal: {passed}/{len(results)} passed")

if __name__ == '__main__':
    main()
