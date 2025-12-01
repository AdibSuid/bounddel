#!/usr/bin/env python3
"""
Test script to simulate exactly what the browser does:
1. Load GeoTIFF like the frontend geotiff.js library
2. Create PNG data URL from canvas
3. Send to backend with bounds
"""

import sys
import base64
import json
import requests
from io import BytesIO
from PIL import Image
import rasterio
import numpy as np

def simulate_browser_geotiff_load(tif_path):
    """Simulate what the browser's geotiff.js library does"""
    print(f"\n1. Loading GeoTIFF (simulating browser): {tif_path}")
    
    with rasterio.open(tif_path) as src:
        # Read RGB bands
        bands = []
        for i in range(1, min(4, src.count + 1)):
            band = src.read(i)
            bands.append(band)
        
        # Get bounds - geotiff.js getBoundingBox() returns [minX, minY, maxX, maxY]
        bounds = src.bounds
        bboxCoords = [bounds.left, bounds.bottom, bounds.right, bounds.top]
        
        print(f"   - Original bounds from GeoTIFF: {bboxCoords}")
        print(f"   - Format: [minX(west), minY(south), maxX(east), maxY(north)]")
        
        # Stack to RGB
        if len(bands) == 1:
            rgb = np.stack([bands[0], bands[0], bands[0]], axis=-1)
        else:
            rgb = np.stack(bands[:3], axis=-1)
        
        # Convert to uint8 (simulating canvas)
        if rgb.dtype in [np.float32, np.float64]:
            rgb = np.clip(rgb * 255, 0, 255).astype(np.uint8)
        elif rgb.max() > 255:
            rgb = ((rgb - rgb.min()) / (rgb.max() - rgb.min()) * 255).astype(np.uint8)
        else:
            rgb = rgb.astype(np.uint8)
        
        print(f"   - Image shape: {rgb.shape}")
        
        # Create PNG data URL (simulating canvas.toDataURL)
        img = Image.fromarray(rgb)
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        png_data = buffer.getvalue()
        data_url = f"data:image/png;base64,{base64.b64encode(png_data).decode()}"
        
        print(f"   - PNG data URL length: {len(data_url)}")
        
        # Frontend stores bounds as: [[bboxCoords[1], bboxCoords[0]], [bboxCoords[3], bboxCoords[2]]]
        # Which is: [[south, west], [north, east]]
        rasterBounds = [[bboxCoords[1], bboxCoords[0]], [bboxCoords[3], bboxCoords[2]]]
        
        print(f"   - rasterBounds (as stored in frontend): {rasterBounds}")
        print(f"   - Format: [[south, west], [north, east]]")
        print(f"   - South: {rasterBounds[0][0]}")
        print(f"   - West: {rasterBounds[0][1]}")
        print(f"   - North: {rasterBounds[1][0]}")
        print(f"   - East: {rasterBounds[1][1]}")
        
        return data_url, rasterBounds

def test_inference(data_url, bbox):
    """Send request to backend exactly like the frontend does"""
    print("\n2. Sending inference request (simulating browser)...")
    
    payload = {
        "bbox": bbox,
        "modelId": "delineate-v1",
        "imageData": data_url
    }
    
    print(f"   - bbox sent to backend: {bbox}")
    print(f"   - modelId: delineate-v1")
    print(f"   - imageData length: {len(data_url)}")
    
    try:
        response = requests.post(
            'http://localhost:8000/infer',
            json=payload,
            timeout=120
        )
        
        print(f"\n3. Response:")
        print(f"   - Status: {response.status_code}")
        
        if response.ok:
            result = response.json()
            print(f"   - Fields detected: {result.get('metadata', {}).get('fieldCount', 0)}")
            print(f"   - Processing time: {result.get('metadata', {}).get('processingTime', 0)}ms")
            print(f"   - Confidence: {result.get('metadata', {}).get('confidence', 0)}")
            
            if result.get('metadata', {}).get('fieldCount', 0) == 0:
                print("\n   ⚠️  WARNING: 0 fields detected!")
                print("   This suggests the bounds or image data might be incorrect.")
            else:
                print(f"\n   ✅ SUCCESS: {result.get('metadata', {}).get('fieldCount', 0)} fields detected!")
            
            return result
        else:
            print(f"   ❌ Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return None

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 test_browser_flow.py <path_to_tif>")
        sys.exit(1)
    
    tif_path = sys.argv[1]
    
    print("="*70)
    print("TESTING EXACT BROWSER FLOW")
    print("="*70)
    
    # Simulate browser loading GeoTIFF
    data_url, rasterBounds = simulate_browser_geotiff_load(tif_path)
    
    # Send to backend
    test_inference(data_url, rasterBounds)
