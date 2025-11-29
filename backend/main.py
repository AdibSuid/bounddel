from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Tuple

from models.delineate_anything import infer_from_image_data

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
    # Accept both camelCase and snake_case via aliases
    image_data: Optional[str] = Field(None, alias='imageData')
    bbox: Optional[List[List[float]]] = None  # [[south, west], [north, east]]
    model_id: Optional[str] = Field(None, alias='modelId')
    model_version: Optional[str] = Field(None, alias='modelVersion')
    parameters: Dict[str, Any] = {}
