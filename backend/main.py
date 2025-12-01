import sys
import os
import logging
import traceback

# Add Delineate-Anything to Python path
delineate_path = os.path.join(os.path.dirname(__file__), '..', 'Delineate-Anything')
if os.path.exists(delineate_path):
    sys.path.insert(0, delineate_path)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Tuple
import json
import asyncio

from models.delineate_anything import infer_from_image_data

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class InferenceRequest(BaseModel):
    model_config = {'protected_namespaces': ()}
    
    # Accept both camelCase and snake_case via aliases
    image_data: Optional[str] = Field(None, alias='imageData')
    bbox: Optional[List[List[float]]] = None  # [[south, west], [north, east]]
    model_id: Optional[str] = Field(None, alias='modelId')
    model_version: Optional[str] = Field(None, alias='modelVersion')
    parameters: Dict[str, Any] = {}


@app.post("/infer")
async def infer(request: InferenceRequest):
    """
    Main inference endpoint for boundary delineation.
    Accepts image data and returns GeoJSON boundaries.
    """
    try:
        logger.info(f"Received inference request with model_id={request.model_id}")
        
        # Validate inputs
        if not request.image_data:
            logger.error("Missing image_data in request")
            raise HTTPException(status_code=400, detail="image_data is required")
        
        if not request.bbox or len(request.bbox) != 2:
            logger.error(f"Invalid bbox format: {request.bbox}")
            raise HTTPException(status_code=400, detail="bbox must be [[south, west], [north, east]]")
        
        # Default model if not specified
        model_id = request.model_id or "delineate-v1"
        logger.info(f"Using model: {model_id}")
        logger.info(f"Bbox: {request.bbox}")
        
        # Convert bbox to tuple format expected by the function
        bbox_tuple = (tuple(request.bbox[0]), tuple(request.bbox[1]))
        
        # Call the delineation function
        logger.info("Starting delineation...")
        result = infer_from_image_data(
            image_data_url=request.image_data,
            model_id=model_id,
            bbox=bbox_tuple
        )
        
        logger.info(f"Delineation completed successfully. Fields: {result.get('metadata', {}).get('fieldCount', 0)}")
        return result
        
    except ValueError as e:
        logger.error(f"ValueError: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))
    except ImportError as e:
        logger.error(f"ImportError: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")


@app.post("/infer-stream")
async def infer_stream(request: InferenceRequest):
    """
    Streaming inference endpoint that sends progress updates via SSE.
    """
    try:
        logger.info(f"Received streaming inference request with model_id={request.model_id}")
        
        # Validate inputs
        if not request.image_data:
            logger.error("Missing image_data in request")
            raise HTTPException(status_code=400, detail="image_data is required")
        
        if not request.bbox or len(request.bbox) != 2:
            logger.error(f"Invalid bbox format: {request.bbox}")
            raise HTTPException(status_code=400, detail="bbox must be [[south, west], [north, east]]")
        
        # Default model if not specified
        model_id = request.model_id or "delineate-v1"
        logger.info(f"Using model: {model_id}")
        logger.info(f"Bbox: {request.bbox}")
        
        # Convert bbox to tuple format
        bbox_tuple = (tuple(request.bbox[0]), tuple(request.bbox[1]))
        
        async def event_generator():
            try:
                # Send initial progress
                yield f"data: {json.dumps({'status': 'starting', 'progress': 0, 'message': 'Initializing delineation...'})}\n\n"
                await asyncio.sleep(0.1)
                
                # Run inference (this will be synchronous, so we simulate progress)
                yield f"data: {json.dumps({'status': 'processing', 'progress': 10, 'message': 'Decoding image data...'})}\n\n"
                await asyncio.sleep(0.1)
                
                yield f"data: {json.dumps({'status': 'processing', 'progress': 20, 'message': 'Running AI model...'})}\n\n"
                await asyncio.sleep(0.1)
                
                # Call the delineation function in a thread to avoid blocking
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    infer_from_image_data,
                    request.image_data,
                    model_id,
                    bbox_tuple
                )
                
                yield f"data: {json.dumps({'status': 'processing', 'progress': 80, 'message': 'Extracting boundaries...'})}\n\n"
                await asyncio.sleep(0.1)
                
                yield f"data: {json.dumps({'status': 'processing', 'progress': 90, 'message': 'Finalizing results...'})}\n\n"
                await asyncio.sleep(0.1)
                
                # Send final result
                result['status'] = 'completed'
                result['progress'] = 100
                logger.info(f"Sending completed result with {result.get('metadata', {}).get('fieldCount', 0)} fields")
                
                # Ensure result is JSON serializable
                try:
                    result_json = json.dumps(result)
                    yield f"data: {result_json}\n\n"
                except Exception as json_error:
                    logger.error(f"Failed to serialize result: {json_error}")
                    raise
                
            except Exception as e:
                logger.error(f"Error in stream: {str(e)}")
                error_data = {
                    'status': 'error',
                    'progress': 0,
                    'message': str(e)
                }
                yield f"data: {json.dumps(error_data)}\n\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Boundary Delineation API is running"}
