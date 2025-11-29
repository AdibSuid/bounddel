import argparse
import geopandas as gpd
from sentinelhub import (
    SHConfig, SentinelHubRequest, DataCollection, MimeType,
    CRS, BBox, bbox_to_dimensions
)
from datetime import datetime, timedelta
import os
import imageio
import rasterio
from rasterio.transform import from_bounds
from rasterio.enums import ColorInterp
from tqdm import tqdm
import numpy as np

def generate_daily_intervals(year):
    intervals = []
    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31)
    delta = end_date - start_date
    for i in range(delta.days + 1):
        day = start_date + timedelta(days=i)
        start = day.strftime("%Y-%m-%d")
        end = (day + timedelta(days=1)).strftime("%Y-%m-%d")
        intervals.append((start, end))
    return intervals

def main(year):
    print(f"Loading AOIs...")
    aoi_path = "AOIs.gpkg"
    aoi = gpd.read_file(aoi_path)
    aoi = aoi.to_crs(epsg=4326)

    # Configure Sentinel Hub credentials and endpoints
    config = SHConfig()
    env_client_id = os.getenv("SH_CLIENT_ID") or os.getenv("SENTINELHUB_CLIENT_ID")
    env_client_secret = os.getenv("SH_CLIENT_SECRET") or os.getenv("SENTINELHUB_CLIENT_SECRET")
    env_auth_base = os.getenv("SH_AUTH_BASE_URL")
    env_base_url = os.getenv("SH_BASE_URL")

    if env_client_id:
        config.sh_client_id = env_client_id
    if env_client_secret:
        config.sh_client_secret = env_client_secret
    if env_auth_base:
        config.sh_auth_base_url = env_auth_base
    if env_base_url:
        config.sh_base_url = env_base_url

    if not config.sh_client_id or not config.sh_client_secret:
        raise ValueError(
            "Sentinel Hub credentials missing or invalid. Set SH_CLIENT_ID and SH_CLIENT_SECRET env vars, "
            "or configure via sentinelhub package. If on non-default deployment, also set SH_AUTH_BASE_URL and SH_BASE_URL."
        )

    # RGB (B04,B03,B02) for delineation-ready tiles
    evalscript = """
    //VERSION=3
    function setup() {
        return {
            input: ["B04", "B03", "B02"],
            output: { bands: 3, sampleType: "FLOAT32" }
        };
    }
    function evaluatePixel(s) {
        return [s.B04, s.B03, s.B02];
    }
    """

    intervals = generate_daily_intervals(year)

    # Determine AOIs to process
    if hasattr(main, "aoi_indices") and main.aoi_indices is not None:
        indices = main.aoi_indices
    else:
        indices = [0]

    for idx in indices:
        geom = aoi.geometry.iloc[idx]
        minx, miny, maxx, maxy = geom.bounds
        bbox = BBox([minx, miny, maxx, maxy], crs=CRS.WGS84)
        resolution = 10
        width, height = bbox_to_dimensions(bbox, resolution=resolution)
        out_dir = f"data/raw/aoi_{idx}"
        os.makedirs(out_dir, exist_ok=True)
        print(f"Downloading daily Sentinel-2 images for AOI {idx} (year {year})...")
        for start, end in tqdm(intervals):
            found_valid = False
            for offset in [0, -2, -1, 1, 2]:
                day = datetime.strptime(start, "%Y-%m-%d") + timedelta(days=offset)
                start_try = day.strftime("%Y-%m-%d")
                end_try = (day + timedelta(days=1)).strftime("%Y-%m-%d")
                req = SentinelHubRequest(
                    evalscript=evalscript,
                    input_data=[
                        SentinelHubRequest.input_data(
                            data_collection=DataCollection.SENTINEL2_L2A,
                            time_interval=(start_try, end_try),
                            mosaicking_order="mostRecent"
                        )
                    ],
                    responses=[SentinelHubRequest.output_response("default", MimeType.TIFF)],
                    bbox=bbox,
                    size=(width, height),
                    config=config,
                )
                data = req.get_data()
                if data and not np.all(data[0] == 0):
                    filename = f"{out_dir}/s2_aoi{idx}_{start}.tif"
                    arr = data[0]  # H x W x 3 (float32 0..1)
                    # Ensure shape is (bands, height, width)
                    if arr.ndim == 3:
                        arr = np.moveaxis(arr, -1, 0)  # 3 x H x W
                    elif arr.ndim == 2:
                        arr = arr[np.newaxis, ...]     # 1 x H x W

                    # Exposure/brightness correction: per-band robust stretch to uint8
                    def stretch_to_uint8(band):
                        valid = band[np.isfinite(band) & (band > 0)]
                        if valid.size < 10:
                            low, high = 0.0, 1.0
                        else:
                            low = np.percentile(valid, 2)
                            high = np.percentile(valid, 98)
                            if not np.isfinite(low):
                                low = 0.0
                            if not np.isfinite(high) or high <= low:
                                high = low + 1.0
                        scaled = (band - low) / (high - low)
                        scaled = np.clip(scaled, 0, 1)
                        return (scaled * 255.0 + 0.5).astype(np.uint8)

                    rgb_uint8 = np.stack([
                        stretch_to_uint8(arr[0]),  # R = B04
                        stretch_to_uint8(arr[1]),  # G = B03
                        stretch_to_uint8(arr[2])   # B = B02
                    ], axis=0)

                    transform = from_bounds(minx, miny, maxx, maxy, width, height)
                    with rasterio.open(
                        filename,
                        'w',
                        driver='GTiff',
                        height=height,
                        width=width,
                        count=3,
                        dtype='uint8',
                        crs='EPSG:4326',
                        transform=transform
                    ) as dst:
                        dst.write(rgb_uint8)
                        dst.colorinterp = (
                            ColorInterp.red, ColorInterp.green, ColorInterp.blue
                        )
                        dst.descriptions = (
                            "B04 Red", "B03 Green", "B02 Blue"
                        )
                    with rasterio.open(filename) as src:
                        print(f"Saved {filename}: CRS={src.crs}, Bounds={src.bounds}, Transform={src.transform}")
                    found_valid = True
                    break
            if not found_valid:
                print(f"No valid image for {start} (and ±2 days), skipping.")
        print(f"Done! Images saved in {out_dir}")
from datetime import datetime, timedelta

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, required=True, help="Year (e.g., 2023)")
    parser.add_argument("--aoi-index", type=int, help="Index of AOI to process (0-based)")
    parser.add_argument("--all", action="store_true", help="Process all AOIs")
    args = parser.parse_args()
    if args.all:
        # Process all AOIs
        aoi_path = "AOIs.gpkg"
        aoi = gpd.read_file(aoi_path)
        main.aoi_indices = list(range(len(aoi)))
    elif args.aoi_index is not None:
        main.aoi_indices = [args.aoi_index]
    else:
        main.aoi_indices = [0]
    main(args.year)