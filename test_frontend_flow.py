#!/usr/bin/env python3
"""
Test script to simulate the frontend flow:
1. Load the GeoTIFF file
2. Convert it to PNG data URL (like the frontend does)
3. Send it to the backend with a bounding box drawn on the map
"""

import sys
import base64
import json
import requests
from io import BytesIO
from PIL import Image
import rasterio
import numpy as np

def load_geotiff_as_frontend(tif_path):
    """Simulate what the frontend does when loading a GeoTIFF"""
    print(f"\n1. Loading GeoTIFF: {tif_path}")
    
    with rasterio.open(tif_path) as src:
        # Read the first 3 bands (RGB)
        bands = []
        for i in range(1, min(4, src.count + 1)):
            band = src.read(i)
            bands.append(band)
        
        # Get bounds
        bounds = src.bounds
        crs = src.crs
        
        print(f"   - CRS: {crs}")
        print(f"   - Bounds: {bounds}")
        print(f"   - Shape: {src.shape}")
        print(f"   - Bands: {len(bands)}")
        
        # Stack bands to RGB
        if len(bands) == 1:
            rgb = np.stack([bands[0], bands[0], bands[0]], axis=-1)
        else:
            rgb = np.stack(bands[:3], axis=-1)
        
        # Check data type and normalize if needed
        print(f"   - Data type: {rgb.dtype}")
        print(f"   - Value range: {rgb.min()} to {rgb.max()}")
        
        # Convert to uint8 if needed (like frontend does)
        if rgb.dtype in [np.float32, np.float64]:
            print("   - Converting float to uint8 (0-1 range assumed)")
            rgb = np.clip(rgb * 255, 0, 255).astype(np.uint8)
        elif rgb.max() > 255:
            print("   - Normalizing values > 255 to 0-255 range")
            rgb = ((rgb - rgb.min()) / (rgb.max() - rgb.min()) * 255).astype(np.uint8)
        else:
            rgb = rgb.astype(np.uint8)
        
        print(f"   - Final RGB shape: {rgb.shape}, dtype: {rgb.dtype}")
        print(f"   - Final value range: {rgb.min()} to {rgb.max()}")
        
        # Convert to PNG data URL (like frontend)
        img = Image.fromarray(rgb)
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        png_data = buffer.getvalue()
        data_url = f"data:image/png;base64,{base64.b64encode(png_data).decode()}"
        
        print(f"   - Data URL length: {len(data_url)} characters")
        
        return data_url, bounds

def test_inference(data_url, bounds):
    """Send request to backend like frontend does"""
    print("\n2. Sending inference request to backend...")
    
    # Use the full image bounds (simulating no bounding box drawn)
    bbox = [[bounds.bottom, bounds.left], [bounds.top, bounds.right]]
    
    print(f"   - BBox: {bbox}")
    
    payload = {
        "bbox": bbox,
        "modelId": "delineate-v1",
        "imageData": data_url
    }
    
    print(f"   - Payload keys: {list(payload.keys())}")
    print(f"   - imageData length: {len(payload['imageData'])}")
    
    try:
        response = requests.post(
            'http://localhost:8000/infer',
            json=payload,
            timeout=120
        )
        
        print(f"\n3. Response received:")
        print(f"   - Status: {response.status_code}")
        
        if response.ok:
            result = response.json()
            print(f"   - Fields detected: {result.get('metadata', {}).get('fieldCount', 0)}")
            print(f"   - Processing time: {result.get('metadata', {}).get('processingTime', 0)}ms")
            print(f"   - Confidence: {result.get('metadata', {}).get('confidence', 0)}")
            
            # Save result
            with open('frontend_flow_result.geojson', 'w') as f:
                json.dump(result.get('boundaries', {}), f, indent=2)
            print(f"\n   ✅ Results saved to: frontend_flow_result.geojson")
            
            return result
        else:
            print(f"   ❌ Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return None

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 test_frontend_flow.py <path_to_tif>")
        sys.exit(1)
    
    tif_path = sys.argv[1]
    
    print("="*70)
    print("TESTING FRONTEND FLOW WITH UPLOADED .TIF")
    print("="*70)
    
    # Load and convert like frontend
    data_url, bounds = load_geotiff_as_frontend(tif_path)
    
    # Send to backend like frontend
    test_inference(data_url, bounds)
