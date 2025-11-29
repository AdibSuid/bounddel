export interface BoundaryModel {
    id: string;
    name: string;
    description: string;
    accuracy: string;
    processingTime: string;
    boundary: GeoJSON.FeatureCollection;
}

export const models: BoundaryModel[] = [
    {
        id: 'agri-field',
        name: 'Agricultural Field Delineation',
        description: 'Optimized for detecting crop field boundaries using multispectral imagery.',
        accuracy: '94%',
        processingTime: '1.2s',
        boundary: {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { type: 'field', crop: 'wheat' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [-122.425, 37.775],
                                [-122.428, 37.775],
                                [-122.428, 37.778],
                                [-122.425, 37.778],
                                [-122.425, 37.775],
                            ],
                        ],
                    },
                },
                {
                    type: 'Feature',
                    properties: { type: 'field', crop: 'corn' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [-122.422, 37.772],
                                [-122.425, 37.772],
                                [-122.425, 37.775],
                                [-122.422, 37.775],
                                [-122.422, 37.772],
                            ],
                        ],
                    },
                },
            ],
        },
    },
    {
        id: 'forest-cover',
        name: 'Forest Cover Analysis',
        description: 'Identifies dense forest regions and canopy coverage.',
        accuracy: '89%',
        processingTime: '2.5s',
        boundary: {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { type: 'forest', density: 'high' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [-122.430, 37.780],
                                [-122.435, 37.780],
                                [-122.435, 37.785],
                                [-122.430, 37.785],
                                [-122.430, 37.780],
                            ],
                        ],
                    },
                },
            ],
        },
    },
    {
        id: 'urban-footprint',
        name: 'Urban Footprint',
        description: 'Detects building footprints and paved surfaces in urban areas.',
        accuracy: '96%',
        processingTime: '3.1s',
        boundary: {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { type: 'building' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [-122.415, 37.765],
                                [-122.418, 37.765],
                                [-122.418, 37.768],
                                [-122.415, 37.768],
                                [-122.415, 37.765],
                            ],
                        ],
                    },
                },
            ],
        },
    },
];
