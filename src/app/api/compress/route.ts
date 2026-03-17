import { NextRequest, NextResponse } from 'next/server';
import ILovePDFApi from '@ilovepdf/ilovepdf-js';
import ILovePDFFile from '@ilovepdf/ilovepdf-js/ILovePDFFile';

// Polyfill XMLHttpRequest for server-side usage
if (typeof global.XMLHttpRequest === 'undefined') {
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

    // Get API key from environment
    const apiKey = process.env.ILOVEPDF_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured. Please set ILOVEPDF_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Map compression levels to iLovePDF values
    const compressionMap: Record<string, string> = {
      'low': 'low',
      'medium': 'medium', 
      'high': 'extreme'
    };
    const compressionLevel = compressionMap[level] || 'medium';

    // Initialize iLovePDF
    const instance = new ILovePDFApi(apiKey);
    const task = instance.newTask('compress');

    // Start the task
    await task.start();

    // Add the file using ILovePDFFile
    const iloveFile = new ILovePDFFile(file);
    await task.addFile(iloveFile);

    // Process with compression level
    await task.process({ compression_level: compressionLevel });

    // Download the result
    const data = await task.download();

    // Convert ArrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(data);
    
    // Create blob
    const blob = new Blob([uint8Array], { type: 'application/pdf' });

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compressed.pdf"`,
      },
    });
  } catch (error) {
    console.error('Compression error:', error);
    
    // More detailed error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Detailed error:', errorMessage);
    
    return NextResponse.json(
      { error: 'Failed to compress PDF. Please check your API key and try again. ' + errorMessage },
      { status: 500 }
    );
  }
}
