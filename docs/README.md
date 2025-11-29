# Documentation

## Backend Setup

1. Install Python dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Set up Delineate-Anything:
   - Add to PYTHONPATH: `export PYTHONPATH=/path/to/Delineate-Anything:$PYTHONPATH`
   - Or install editable: `pip install -e /path/to/Delineate-Anything`

3. Run the FastAPI server:
   ```bash
   cd backend
   PYTHONPATH=/path/to/Delineate-Anything python main.py
   # Or uvicorn main:app --host 0.0.0.0 --port 8000
   ```

## API Documentation

### Backend Endpoints

- `POST /infer`: Perform boundary delineation
  - Body: `{imageData: string, bbox: [[number, number], [number, number]], modelId?: string}`
  - Response: `{boundaries: GeoJSON, metadata: {fieldCount: number, processingTime: number, confidence: number}}`

## Configuration

### Model Parameters

- `minimum_area_m2`: Minimum field area in square meters (default: 2500)
- `minimal_confidence`: Minimum detection confidence (default: 0.005)
- `batch_size`: Inference batch size (default: 4)

### Environment Variables

- `SH_CLIENT_ID`: Sentinel Hub client ID (for image download)
- `SH_CLIENT_SECRET`: Sentinel Hub client secret
- `PYTHONPATH`: Path to Delineate-Anything repository

## Deployment

### Local Development

Run both services:
```bash
npm run dev
```

### Docker

[Add Docker instructions]

### Cloud

[Add cloud deployment instructions]