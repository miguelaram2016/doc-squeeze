import { NextRequest, NextResponse } from 'next/server';

// This API route is now a placeholder since we do client-side compression
// Kept for potential future use (e.g., advanced server-side compression)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Client-side compression is now the main method
    // This endpoint can be used for future server-side enhancements
    return NextResponse.json({ 
      message: 'Use client-side compression',
      status: 'ok' 
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: 'Invalid request' 
    }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    name: 'DocSqueeze API',
    version: '1.0.0',
    compression: 'client-side'
  });
}
