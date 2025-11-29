# Boundary Delineation App

A full-stack application for delineating field boundaries using satellite imagery and AI.

## Project Structure

```
boundary-delineation-app/
├── frontend/          # Next.js React application
│   ├── app/           # Next.js app router
│   ├── components/    # React components
│   ├── lib/           # Utility functions and types
│   ├── public/        # Static assets
│   └── package.json   # Frontend dependencies
├── backend/           # FastAPI Python backend
│   ├── models/        # AI models and inference
│   ├── data/          # Downloaded data
│   └── requirements.txt # Python dependencies
├── docs/              # Documentation
└── README.md          # This file
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Sentinel Hub credentials (for downloading images)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd boundary-delineation-app
   ```

2. Install all dependencies:
   ```bash
   npm run install:all
   ```

3. Set up environment variables:
   - For Sentinel Hub: Set `SH_CLIENT_ID` and `SH_CLIENT_SECRET`
   - For Delineate-Anything: Ensure PYTHONPATH includes the repo path

### Development

Run both frontend and backend:
```bash
npm run dev
```

Or run separately:
```bash
npm run dev:frontend  # Next.js on http://localhost:3000
npm run dev:backend   # FastAPI on http://localhost:8000
```

### Building

Build the frontend:
```bash
npm run build:frontend
```

## Technologies

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Leaflet
- **Backend**: FastAPI, Python, Delineate-Anything, GeoPandas, Rasterio
- **AI**: PyTorch-based field boundary detection

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Ensure all dependencies are properly managed

## License

[Add license information]
