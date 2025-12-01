import base64
import io
import json
import os
import sys
import shutil
import tempfile
import time
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_bounds
from rasterio.enums import Resampling
import geopandas as gpd

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Suppress verbose logs from delineate modules
logging.getLogger('methods.main.inference').setLevel(logging.WARNING)
logging.getLogger('huggingface_hub').setLevel(logging.WARNING)

# Add Delineate-Anything to Python path if not already there
delineate_path = os.path.join(os.path.dirname(__file__), '..', '..', 'Delineate-Anything')
if os.path.exists(delineate_path) and delineate_path not in sys.path:
    sys.path.insert(0, delineate_path)
    logger.info(f"Added Delineate-Anything to sys.path: {delineate_path}")

# Import the repo's delineate entrypoint
try:
    from delineate import delineate as _da_delineate  # type: ignore
    logger.info("Successfully imported delineate function")
except Exception as e:  # pragma: no cover
    logger.error(f"Failed to import delineate: {e}")
    _da_delineate = None  # type: ignore


def _decode_data_url_png(data_url: str) -> np.ndarray:
    if "," in data_url:
        payload = data_url.split(",", 1)[1]
    else:
        payload = data_url
    img_bytes = base64.b64decode(payload)
    with Image.open(io.BytesIO(img_bytes)) as im:
        im = im.convert("RGB")
        return np.array(im)


def _write_geotiff(rgb: np.ndarray, bounds: Tuple[Tuple[float, float], Tuple[float, float]], dst_path: str) -> None:
    (south, west), (north, east) = bounds
    height, width = rgb.shape[0], rgb.shape[1]
    transform = from_bounds(west, south, east, north, width=width, height=height)
    profile = {
        "driver": "GTiff",
        "height": height,
        "width": width,
        "count": 3,
        "dtype": rasterio.uint8,
        "crs": "EPSG:4326",
        "transform": transform,
        "interleave": "band",
        "tiled": True,
        "compress": "deflate",
        "predictor": 2,
    }
    with rasterio.open(dst_path, "w", **profile) as dst:
        dst.write(rgb[:, :, 0], 1)
        dst.write(rgb[:, :, 1], 2)
        dst.write(rgb[:, :, 2], 3)


def _build_config(model_id: str, src_folder: str, temp_folder: str, output_path: str) -> Dict[str, Any]:
    # Map our UI model ids to repo model names
    # Prefer local checkpoint paths via env to bypass Hugging Face download
    env_large = os.getenv("DA_LOCAL_MODEL_LARGE")
    env_small = os.getenv("DA_LOCAL_MODEL_SMALL")
    model_map = {
        "delineate-v1": env_large or "large",
        "delineate-v2": env_large or "large",
        "delineate-hd": env_small or "small",
    }
    model_name = model_map.get(model_id, env_large or "large")
    
    # Lower confidence threshold for v1 to detect more fields
    min_confidence = 0.001 if model_id == "delineate-v1" else 0.005

    # Minimal config based on conf_sample.yaml with safe defaults and overridden bands [1,2,3]
    return {
        # The repo accepts either named models ("small"/"large") or absolute checkpoint paths
        "model": [model_name],
        "method": "main",
        "execution_args": {
            "src_folder": src_folder,
            "temp_folder": temp_folder,
            "output_path": output_path,
            "keep_temp": False,
            "mask_filepath": None,
        },
        "data_loader": {
            "skip": False,
            "bands": [1, 2, 3],
            "nodata_band": None,
            "nodata_value": [0, 0, 0],
            "min": None,
            "max": None,
        },
        "execution_planner": {
            "region_width": 4096,
            "region_height": 4096,
            "pixel_offset": [-1, -1],
        },
        "postprocess_limits": {
            "num_workers": [2, 2],
            "queue_tiles_capacity": 32,
            "max_tiles_inflight": 64,
        },
        "passes": [
            {
                "batch_size": 4,
                "tile_size": None,
                "tile_step": 0.5,
                "model_args": [
                    {"name": model_name, "minimal_confidence": min_confidence, "use_half": False}
                ],
                "delineation_config": {
                    "pixel_area_threshold": 512,
                    "remaining_area_threshold": 0.8,
                    "compose_merge_iou": 0.8,
                    "merge_iou": 0.8,
                    "merge_relative_area_threshold": 0.5,
                    "merge_asymetric_pixel_area_threshold": 32,
                    "merge_asymetric_relative_area_threshold": 0.7,
                    "merging_edge_width": 4,
                    "merge_edge_iou": 0.6,
                    "merge_edge_pixels": 192,
                },
            }
        ],
        "polygonization_args": {
            "layer_name": "fields",
            "override_if_exists": True,
        },
        "filtering_args": {
            "minimum_area_m2": 1000,  # Reduced from 2500 to detect smaller fields
            "minimum_part_area_m2": 0,
            "minimum_hole_area_m2": 1000,  # Reduced from 2500
            "minimum_background_field_area_m2": 0,
            "minimum_background_field_hole_area_m2": 0,
            "middleground_offset": 0,
            "minimum_middleground_field_area_m2": 0,
            "minimum_middleground_field_hole_area_m2": 0,
        },
        "simplification_args": {"simplify": True, "epsilon_scale": 1, "num_workers": -1, "raster_resolution": [4096, 4096]},
        "super_resolution": None,
        "treat_as_vrt": False,
        "mask_info": {"range": 24, "filter_classes": [1, 10, 12, 23], "clip_classes": [0, 13, 14]},
        "background_info": {"background_classes_from_mask": [], "additional_source": None},
    }


def infer_from_image_data(image_data_url: str, model_id: str, bbox: Optional[Tuple[Tuple[float, float], Tuple[float, float]]] = None) -> Dict[str, Any]:
    logger.info(f"Starting inference with model_id={model_id}, bbox={bbox}")
    
    if _da_delineate is None:
        error_msg = "Delineate-Anything repo not importable. Install it (pip -e) or add to PYTHONPATH."
        logger.error(error_msg)
        raise ImportError(error_msg)
    
    if bbox is None:
        error_msg = "bbox is required to georeference the input image."
        logger.error(error_msg)
        raise ValueError(error_msg)

    job_dir = Path(tempfile.mkdtemp(prefix="da_job_"))
    logger.info(f"Created job directory: {job_dir}")
    
    images_dir = job_dir / "images"
    temp_dir = job_dir / "temp"
    out_dir = job_dir / "out"
    images_dir.mkdir(parents=True, exist_ok=True)
    temp_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.time()

    try:
        # Decode image and write a georeferenced GeoTIFF
        logger.info("Decoding image data...")
        rgb = _decode_data_url_png(image_data_url)
        logger.info(f"Image decoded. Shape: {rgb.shape}, dtype: {rgb.dtype}")
        
        tif_path = images_dir / "input.tif"
        logger.info(f"Writing GeoTIFF to: {tif_path}")
        _write_geotiff(rgb, bbox, str(tif_path))
        logger.info(f"GeoTIFF written successfully")

        # Build a minimal config and execute delineation
        gpkg_path = out_dir / "result.gpkg"
        logger.info(f"Building config for model: {model_id}")
        config = _build_config(model_id=model_id, src_folder=str(images_dir), temp_folder=str(temp_dir), output_path=str(gpkg_path))
        
        args = {"config": config, "input": str(images_dir), "temp": str(temp_dir), "output": str(gpkg_path), "keep_temp": False, "mask": None}
        logger.info("Starting delineation process...")
        _da_delineate(args, verbose=False)
        logger.info("Delineation process completed")

        # Read the result and convert to GeoJSON FeatureCollection
        if not gpkg_path.exists():
            error_msg = f"Delineation output not found at: {gpkg_path}"
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)

        logger.info(f"Reading result from: {gpkg_path}")
        gdf = gpd.read_file(gpkg_path)
        logger.info(f"Read {len(gdf)} features from GeoPackage")
        
        feature_collection = json.loads(gdf.to_json())
        t1 = time.time()
        
        processing_time = int((t1 - t0) * 1000)
        logger.info(f"Inference completed in {processing_time}ms. Field count: {len(gdf)}")

        return {
            "boundaries": feature_collection,
            "metadata": {
                "fieldCount": int(len(gdf)),
                "processingTime": processing_time,
                "confidence": 0.9,
            },
        }
    except Exception as e:
        logger.error(f"Error during inference: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise
    finally:
        # Clean up temporary files
        try:
            logger.info(f"Cleaning up temporary directory: {job_dir}")
            shutil.rmtree(job_dir, ignore_errors=True)
        except Exception as e:
            logger.warning(f"Failed to clean up temporary directory: {e}")
