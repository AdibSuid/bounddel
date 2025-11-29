import { FeatureCollection, Feature, Polygon } from 'geojson';
import { DelineateModel } from './types';

/**
 * Available DelineateAnything models
 */
export const AVAILABLE_MODELS: DelineateModel[] = [
    {
        id: 'delineate-v1',
        name: 'DelineateAnything v1.0',
        description: 'Standard model for field boundary detection',
        version: '1.0'
    },
    {
        id: 'delineate-v2',
        name: 'DelineateAnything v2.0',
        description: 'Enhanced model with improved accuracy',
        version: '2.0'
    },
    {
        id: 'delineate-hd',
        name: 'DelineateAnything HD',
        description: 'High-definition model for detailed boundaries',
        version: '2.1-hd'
    }
];

/**
 * Bounding box coordinates: [[south, west], [north, east]]
 */
export type BBox = [[number, number], [number, number]];

export interface DelineationRequest {
    bbox: BBox;
    resolution?: number; // meters per pixel
    modelVersion?: string; // kept for backward compatibility
    modelId?: string; // preferred explicit model selector
    imageData?: string; // data URL for the raster currently visible
}

export interface DelineationResult {
    boundaries: FeatureCollection<Polygon>;
    metadata: {
        fieldCount: number;
        processingTime: number;
        confidence?: number;
    };
}

/**
 * Mock implementation of DelineateAnything model
 * Generates realistic-looking field boundaries within a bounding box
 * 
 * TODO: Replace with actual model API call when endpoint is available
 */
export async function delineateFields(request: DelineationRequest): Promise<DelineationResult> {
    // Call backend API for real inference
    const response = await fetch('/api/delineate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
    });
    if (!response.ok) {
        throw new Error('Failed to get delineation result from backend');
    }
    // The backend returns a result object
    const result = await response.json();
    // Adapt backend response to DelineationResult type if needed
    // For now, assume backend returns boundaries and metadata
    return result;
}

/**
 * Generate a random field polygon within the given bounds
 */
function generateRandomField(
    south: number,
    west: number,
    north: number,
    east: number,
    index: number
): Feature<Polygon> {
    // Calculate dimensions
    const latRange = north - south;
    const lonRange = east - west;

    // Random field size (20-40% of bbox in each dimension)
    const fieldLatSize = latRange * (0.2 + Math.random() * 0.2);
    const fieldLonSize = lonRange * (0.2 + Math.random() * 0.2);

    // Random position within bbox
    const fieldSouth = south + Math.random() * (latRange - fieldLatSize);
    const fieldWest = west + Math.random() * (lonRange - fieldLonSize);
    const fieldNorth = fieldSouth + fieldLatSize;
    const fieldEast = fieldWest + fieldLonSize;

    // Create slightly irregular polygon (not perfect rectangle)
    const irregularity = 0.1; // 10% irregularity
    const coordinates = [
        [
            [fieldWest + (Math.random() - 0.5) * fieldLonSize * irregularity, fieldSouth + (Math.random() - 0.5) * fieldLatSize * irregularity],
            [fieldEast + (Math.random() - 0.5) * fieldLonSize * irregularity, fieldSouth + (Math.random() - 0.5) * fieldLatSize * irregularity],
            [fieldEast + (Math.random() - 0.5) * fieldLonSize * irregularity, fieldNorth + (Math.random() - 0.5) * fieldLatSize * irregularity],
            [fieldWest + (Math.random() - 0.5) * fieldLonSize * irregularity, fieldNorth + (Math.random() - 0.5) * fieldLatSize * irregularity],
            [fieldWest + (Math.random() - 0.5) * fieldLonSize * irregularity, fieldSouth + (Math.random() - 0.5) * fieldLatSize * irregularity], // Close the ring
        ]
    ];

    // Random crop types for realism
    const cropTypes = ['wheat', 'corn', 'soybean', 'rice', 'cotton', 'barley', 'oats'];
    const cropType = cropTypes[Math.floor(Math.random() * cropTypes.length)];

    return {
        type: 'Feature',
        properties: {
            id: `field-${index + 1}`,
            crop: cropType,
            area: calculateArea(coordinates[0]),
            confidence: 0.8 + Math.random() * 0.15,
            source: 'DelineateAnything (Mock)'
        },
        geometry: {
            type: 'Polygon',
            coordinates
        }
    };
}

/**
 * Simple area calculation (approximate, for mock data)
 */
function calculateArea(ring: number[][]): number {
    // Very rough approximation in hectares
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    return Math.abs(area / 2) * 10000; // Convert to approximate hectares
}

/**
 * Validate bounding box
 */
export function validateBBox(bbox: BBox): { valid: boolean; error?: string } {
    const [[south, west], [north, east]] = bbox;

    if (south >= north) {
        return { valid: false, error: 'South latitude must be less than north latitude' };
    }

    if (west >= east) {
        return { valid: false, error: 'West longitude must be less than east longitude' };
    }

    if (south < -90 || north > 90 || west < -180 || east > 180) {
        return { valid: false, error: 'Coordinates out of valid range' };
    }

    // Check if bbox is too large (> 1 degree in any dimension)
    if (north - south > 1 || east - west > 1) {
        return { valid: false, error: 'Bounding box too large. Please select a smaller area (max 1° x 1°)' };
    }

    return { valid: true };
}
