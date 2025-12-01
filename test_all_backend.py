#!/usr/bin/env python3
"""
Test all .tif files in Downloads directory through backend API
"""
import os
import sys
import glob
import requests
import base64
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from PIL import Image
import io
import time

# Find all .tif files
tif_files = glob.glob(os.path.expanduser("~/Downloads/**/*.tif"), recursive=True)
print(f"Found {len(tif_files)} .tif files\n")

results = []

for idx, tif_path in enumerate(tif_files[:10], 1):  # Test first 10 files
    filename = os.path.basename(tif_path)
    print(f"[{idx}/{min(10, len(tif_files))}] Testing: {filename}")
    
    try:
        # Open with rasterio to get bounds and data
        with rasterio.open(tif_path) as src:
            # Get bounds
            bounds = src.bounds
            crs = src.crs
            width = src.width
            height = src.height
            
            print(f"  - Size: {width}x{height}, CRS: {crs}")
            print(f"  - Bounds: {bounds}")
            
            # Reproject to EPSG:4326 if needed
            if crs and crs.to_epsg() != 4326:
                dst_crs = 'EPSG:4326'
                transform, width_new, height_new = calculate_default_transform(
                    crs, dst_crs, width, height, *bounds
                )
                
                # Get bbox in WGS84
                from rasterio.transform import array_bounds
                wgs84_bounds = array_bounds(height_new, width_new, transform)
                bbox = [[wgs84_bounds[1], wgs84_bounds[0]], [wgs84_bounds[3], wgs84_bounds[2]]]
                
                print(f"  - Reprojected to WGS84: {bbox}")
            else:
                bbox = [[bounds.bottom, bounds.left], [bounds.top, bounds.right]]
            
            # Read image data (first 3 bands as RGB)
            data = src.read([1, 2, 3])
            
            # Convert to uint8 if needed
            if data.dtype != 'uint8':
                data = ((data - data.min()) / (data.max() - data.min()) * 255).astype('uint8')
            
            # Create PIL image
            img = Image.fromarray(data.transpose(1, 2, 0))
            
            # Convert to PNG data URL
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            img_base64 = base64.b64encode(buffer.read()).decode()
            image_data = f"data:image/png;base64,{img_base64}"
            
            print(f"  - Image data URL length: {len(image_data)}")
            
            # Call backend API
            start_time = time.time()
            response = requests.post(
                'http://localhost:8000/infer',
                json={
                    'imageData': image_data,
                    'bbox': bbox,
                    'modelId': 'delineate-v1'
                },
                timeout=600  # 10 minute timeout
            )
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                field_count = result.get('metadata', {}).get('fieldCount', 0)
                processing_time = result.get('metadata', {}).get('processingTime', 0)
                
                print(f"  ✅ SUCCESS: {field_count} fields detected in {elapsed:.1f}s (backend: {processing_time}ms)")
                results.append({
                    'file': filename,
                    'status': 'success',
                    'fields': field_count,
                    'time': elapsed
                })
            else:
                print(f"  ❌ FAILED: HTTP {response.status_code} - {response.text[:200]}")
                results.append({
                    'file': filename,
                    'status': 'failed',
                    'error': f"HTTP {response.status_code}"
                })
                
    except Exception as e:
        print(f"  ❌ ERROR: {str(e)}")
        results.append({
            'file': filename,
            'status': 'error',
            'error': str(e)
        })
    
    print()

# Summary
print("\n" + "="*70)
print("SUMMARY")
print("="*70)
success = [r for r in results if r['status'] == 'success']
failed = [r for r in results if r['status'] != 'success']

print(f"\nTotal tested: {len(results)}")
print(f"Success: {len(success)}")
print(f"Failed: {len(failed)}")

if success:
    print(f"\nSuccessful detections:")
    for r in success:
        print(f"  - {r['file']}: {r['fields']} fields ({r['time']:.1f}s)")

if failed:
    print(f"\nFailed:")
    for r in failed:
        print(f"  - {r['file']}: {r.get('error', 'Unknown error')}")
