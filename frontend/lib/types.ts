import { FeatureCollection } from 'geojson';

export interface FeatureMetadata {
    id: string;
    name: string;
    bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
}

export interface Layer {
    id: string;
    name: string;
    type: 'vector' | 'raster';
    data?: FeatureCollection; // For vector layers
    visible: boolean;
    color: string;
    description?: string; // Optional, from original mock data
    features?: FeatureMetadata[]; // Individual features with bounds
    // For raster layers
    rasterUrl?: string; // Data URL or object URL for the raster image
    rasterBounds?: [[number, number], [number, number]]; // [[south, west], [north, east]]
}

export interface DelineateModel {
    id: string;
    name: string;
    description: string;
    version: string;
}

export interface BoundingBox {
    id: string;
    bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
    status: 'pending' | 'processing' | 'completed' | 'error';
    createdAt: Date;
    layerId?: string; // ID of the generated layer (if completed)
    error?: string; // Error message (if status is 'error')
    modelId?: string; // Selected model for this bounding box
}

export type DrawingMode = 'none' | 'rectangle';
