#!/usr/bin/env python3
"""
Test script for the boundary delineation API
"""
import requests
import json
import base64
from PIL import Image
import io
import numpy as np

def create_test_image():
    """Create a simple test image"""
    # Create a 512x512 RGB image with some patterns
    img = np.zeros((512, 512, 3), dtype=np.uint8)
    
    # Add some field-like patterns
    img[100:200, 100:300] = [100, 150, 50]  # Green field
    img[250:400, 150:400] = [120, 160, 60]  # Another field
    img[50:150, 350:480] = [90, 140, 45]    # Third field
    
    return img

def image_to_data_url(img_array):
    """Convert numpy array to base64 data URL"""
    img = Image.fromarray(img_array.astype(np.uint8))
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_bytes = buffer.getvalue()
    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
    return f"data:image/png;base64,{img_b64}"

def test_health_check():
    """Test the health check endpoint"""
    print("Testing health check endpoint...")
    response = requests.get('http://localhost:8000/')
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    return response.status_code == 200

def test_inference():
    """Test the inference endpoint with a sample image"""
    print("\nTesting inference endpoint...")
    
    # Create test image
    print("Creating test image...")
    img = create_test_image()
    image_data = image_to_data_url(img)
    
    # Prepare request
    payload = {
        "imageData": image_data[:100] + "..." if len(image_data) > 100 else image_data,  # Truncate for display
        "bbox": [[34.27442728830016, -102.43294308920643], [34.34969291893765, -102.34321495239912]],
        "modelId": "delineate-v1"
    }
    
    # Show request info
    print(f"Request payload keys: {list(payload.keys())}")
    print(f"Image data length: {len(image_data)} characters")
    print(f"Bbox: {payload['bbox']}")
    print(f"Model: {payload['modelId']}")
    
    # Replace truncated image data with full version
    payload["imageData"] = image_data
    
    # Make request
    print("\nSending request to backend...")
    try:
        response = requests.post(
            'http://localhost:8000/infer',
            json=payload,
            timeout=120  # 2 minute timeout for model inference
        )
        
        print(f"\nStatus: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Inference successful!")
            print(f"Fields detected: {result.get('metadata', {}).get('fieldCount', 0)}")
            print(f"Processing time: {result.get('metadata', {}).get('processingTime', 0)}ms")
            print(f"Confidence: {result.get('metadata', {}).get('confidence', 0)}")
            
            # Show first feature if available
            if 'boundaries' in result and 'features' in result['boundaries']:
                features = result['boundaries']['features']
                print(f"Total features: {len(features)}")
                if features:
                    print(f"First feature type: {features[0].get('geometry', {}).get('type')}")
            
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out (this might be normal for first run as model downloads)")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_frontend():
    """Test if frontend is accessible"""
    print("\nTesting frontend...")
    # Try multiple ports as Next.js may use different ports
    for port in [3000, 3001, 3002, 3003, 3004, 3005]:
        try:
            response = requests.get(f'http://localhost:{port}/', timeout=3)
            if response.status_code == 200:
                print(f"✅ Frontend is accessible on port {port}")
                return True
        except:
            continue
    
    print(f"❌ Frontend not accessible on any port (3000-3005)")
    return False

def main():
    print("="*60)
    print("BOUNDARY DELINEATION API TEST")
    print("="*60)
    
    results = {
        "Health Check": test_health_check(),
        "Frontend": test_frontend(),
        "Inference": test_inference()
    }
    
    print("\n" + "="*60)
    print("TEST RESULTS SUMMARY")
    print("="*60)
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    all_passed = all(results.values())
    print("\n" + "="*60)
    if all_passed:
        print("🎉 ALL TESTS PASSED! Application is fully functional.")
    else:
        print("⚠️  Some tests failed. Check the output above.")
    print("="*60)
    
    return all_passed

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
