import { NextRequest, NextResponse } from 'next/server';

// Polyfill XMLHttpRequest for server-side
if (!global.XMLHttpRequest) {
  // @ts-ignore
  global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const level = formData.get('level') as string || 'medium';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Get API keys from environment
    const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
    const secretKey = process.env.ILOVEPDF_SECRET_KEY;
    
    console.log('Public key present:', !!publicKey);
    console.log('Secret key present:', !!secretKey);
    
    if (!publicKey || !secretKey) {
      return NextResponse.json(
        { error: 'API keys not configured. Please set ILOVEPDF_PUBLIC_KEY and ILOVEPDF_SECRET_KEY environment variables.' },
        { status: 500 }
      );
    }

    // Map compression levels to iLovePDF values
    const compressionMap: Record<string, string> = {
      'low': 'low',
      'medium': 'recommended', 
      'high': 'extreme'
    };
    const compressionLevel = compressionMap[level] || 'recommended';

    // Get file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('Initializing iLovePDF with public key...');
    
    // Use the SDK
    const ILovePDF = require('@ilovepdf/ilovepdf-js');
    const ilovepdf = new ILovePDF(publicKey, secretKey);
    
    console.log('Creating compress task...');
    const task = ilovepdf.compress();
    
    console.log('Adding file to compress...');
    // Add the file from buffer
    task.addFile(buffer, { filename: file.name });
    
    console.log('Processing...');
    // Process with compression level
    await task.process({ compression_level: compressionLevel });
    
    console.log('Downloading...');
    // Download the result
    const resultBlob = await task.download();
    
    console.log('Got result, size:', resultBlob.size);
    
    // Return the compressed file
    return new NextResponse(resultBlob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compressed_${file.name}"`,
      },
    });
  } catch (error) {
    console.error('Compression error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { error: 'Failed to compress PDF. ' + errorMessage },
      { status: 500 }
    );
  }
}
