import base64
import io
import json
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_bounds
from rasterio.enums import Resampling
import geopandas as gpd

# Import the repo's delineate entrypoint
try:
    from delineate import delineate as _da_delineate  # type: ignore
except Exception as e:  # pragma: no cover
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
        # Provide polygonization defaults at top-level to satisfy methods.main.inference expectations
        "polygonization_args": {
            "layer_name": "fields",
            "override_if_exists": True,
            "minimum_background_field_area_m2": 0
        },
        "minimum_background_field_area_m2": 0,
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
                    {"name": model_name, "minimal_confidence": 0.005, "use_half": False}
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
        "polygonization_args": {"layer_name": "fields", "override_if_exists": True, "minimum_background_field_area_m2": 0},
            }
        ],
        "simplification_args": {"simplify": True, "epsilon_scale": 1, "num_workers": -1, "raster_resolution": [4096, 4096]},
        "super_resolution": None,
        "treat_as_vrt": False,
        "mask_info": {"range": 24, "filter_classes": [1, 10, 12, 23], "clip_classes": [0, 13, 14]},
        "background_info": {"background_classes_from_mask": [], "additional_source": None},
        "filtering_args": {
            "minimum_area_m2": 2500,
            "minimum_part_area_m2": 0,
            "minimum_hole_area_m2": 2500,
            "minimum_background_field_area_m2": 0,
            "minimum_background_field_hole_area_m2": 0,
            "middleground_offset": 0,
            "minimum_middleground_field_area_m2": 0,
            "minimum_middleground_field_hole_area_m2": 0,
        },
    }


def infer_from_image_data(image_data_url: str, model_id: str, bbox: Optional[Tuple[Tuple[float, float], Tuple[float, float]]] = None) -> Dict[str, Any]:
    if _da_delineate is None:
        raise ImportError(
            "Delineate-Anything repo not importable. Install it (pip -e) or add to PYTHONPATH."
        )
    if bbox is None:
        raise ValueError("bbox is required to georeference the input image.")

    job_dir = Path(tempfile.mkdtemp(prefix="da_job_"))
    images_dir = job_dir / "images"
    temp_dir = job_dir / "temp"
    out_dir = job_dir / "out"
    images_dir.mkdir(parents=True, exist_ok=True)
    temp_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.time()

    try:
        # Decode image and write a georeferenced GeoTIFF
        rgb = _decode_data_url_png(image_data_url)
        tif_path = images_dir / "input.tif"
        _write_geotiff(rgb, bbox, str(tif_path))

        # Build a minimal config and execute delineation
        gpkg_path = out_dir / "result.gpkg"
        config = _build_config(model_id=model_id, src_folder=str(images_dir), temp_folder=str(temp_dir), output_path=str(gpkg_path))
        print("Pass polygonization_args:", config["passes"][0]["polygonization_args"])
        args = {"config": config, "input": str(images_dir), "temp": str(temp_dir), "output": str(gpkg_path), "keep_temp": False, "mask": None}
        _da_delineate(args, verbose=False)

        # Read the result and convert to GeoJSON FeatureCollection
        if not gpkg_path.exists():
            raise FileNotFoundError("Delineation output not found.")

        gdf = gpd.read_file(gpkg_path)
        feature_collection = json.loads(gdf.to_json())
        t1 = time.time()

        return {
            "boundaries": feature_collection,
            "metadata": {
                "fieldCount": int(len(gdf)),
                "processingTime": int((t1 - t0) * 1000),
                "confidence": 0.9,
            },
        }
    finally:
        # Clean up temporary files
        try:
            shutil.rmtree(job_dir, ignore_errors=True)
        except Exception:
            pass
