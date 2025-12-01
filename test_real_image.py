#!/usr/bin/env python3
"""
Test the API with a real satellite image
"""
import requests
import json
import base64
from PIL import Image
import io
import numpy as np
import rasterio
from rasterio.warp import transform_bounds

def load_image_from_geotiff(tif_path):
    """Load RGB image and bounds from a GeoTIFF file."""
    with rasterio.open(tif_path) as src:
        # Read RGB bands (assuming bands 1,2,3 are RGB)
        rgb = src.read([1,2,3]).transpose(1, 2, 0)  # (height, width, 3)
        
        # Get bounds in EPSG:4326
        left, bottom, right, top = src.bounds
        print(f"Original CRS: {src.crs}")
        print(f"Original bounds: {src.bounds}")
        
        if src.crs.to_string() != 'EPSG:4326':
            left_4326, bottom_4326, right_4326, top_4326 = transform_bounds(
                src.crs, 'EPSG:4326', left, bottom, right, top
            )
        else:
            left_4326, bottom_4326, right_4326, top_4326 = left, bottom, right, top
        
        print(f"Bounds in EPSG:4326: ({bottom_4326}, {left_4326}) to ({top_4326}, {right_4326})")
        
        # Convert to ((south, west), (north, east))
        bbox = [[bottom_4326, left_4326], [top_4326, right_4326]]
        
        print(f"Image shape: {rgb.shape}")
        print(f"Image dtype: {rgb.dtype}")
        print(f"Value range: {rgb.min()} - {rgb.max()}")
        
    return rgb, bbox

def image_to_data_url(image_array):
    """Convert numpy array to base64 data URL."""
    # Normalize to 0-255 if needed
    if image_array.max() > 255:
        image_array = ((image_array - image_array.min()) / (image_array.max() - image_array.min()) * 255).astype(np.uint8)
    
    img = Image.fromarray(image_array.astype(np.uint8))
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_bytes = buffer.getvalue()
    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
    return f"data:image/png;base64,{img_b64}"

def test_inference_with_real_image(image_path):
    """Test the inference endpoint with a real satellite image"""
    print("="*70)
    print("TESTING WITH REAL SATELLITE IMAGE")
    print("="*70)
    
    # Load the image
    print(f"\nLoading image from: {image_path}")
    try:
        rgb, bbox = load_image_from_geotiff(image_path)
    except Exception as e:
        print(f"❌ Error loading image: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Convert to data URL
    print("\nConverting to data URL...")
    image_data = image_to_data_url(rgb)
    print(f"Data URL length: {len(image_data)} characters")
    
    # Prepare request
    payload = {
        "imageData": image_data,
        "bbox": bbox,
        "modelId": "delineate-v1"
    }
    
    print(f"\nSending request to backend...")
    print(f"Bbox: {bbox}")
    print(f"Model: delineate-v1")
    
    # Make request
    try:
        response = requests.post(
            'http://localhost:8000/infer',
            json=payload,
            timeout=300  # 5 minute timeout
        )
        
        print(f"\nStatus: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("\n" + "="*70)
            print("✅ INFERENCE SUCCESSFUL!")
            print("="*70)
            print(f"Fields detected: {result.get('metadata', {}).get('fieldCount', 0)}")
            print(f"Processing time: {result.get('metadata', {}).get('processingTime', 0)}ms ({result.get('metadata', {}).get('processingTime', 0)/1000:.1f}s)")
            print(f"Confidence: {result.get('metadata', {}).get('confidence', 0)}")
            
            # Show features info
            if 'boundaries' in result and 'features' in result['boundaries']:
                features = result['boundaries']['features']
                print(f"\nTotal features in GeoJSON: {len(features)}")
                if features:
                    print(f"First feature geometry type: {features[0].get('geometry', {}).get('type')}")
                    
                    # Save the result
                    output_file = 'inference_result.geojson'
                    with open(output_file, 'w') as f:
                        json.dump(result['boundaries'], f, indent=2)
                    print(f"\n✅ Results saved to: {output_file}")
            
            return True
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("\n❌ Request timed out")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 test_real_image.py <path_to_geotiff>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"Error: Image file not found: {image_path}")
        sys.exit(1)
    
    success = test_inference_with_real_image(image_path)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    import os
    main()
