import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Parse incoming request (e.g., image data, parameters)
  const body = await request.json();

  // Example: Proxy to external AI inference server
  // Replace 'http://localhost:8000/infer' with your actual Python backend endpoint
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout
  
  try {
    const response = await fetch('http://localhost:8000/infer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout - processing took too long' }, { status: 504 });
    }
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 });
  }
}

// Increase route timeout to 10 minutes
export const maxDuration = 600;
