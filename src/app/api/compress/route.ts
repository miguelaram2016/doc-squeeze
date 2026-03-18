import { NextRequest, NextResponse } from 'next/server';

// iLovePDF API configuration
const ILOVEPDF_PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY;
const ILOVEPDF_SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const level = formData.get('level') as string || 'recommended';

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

    // Map compression levels to iLovePDF values
    const compressionMap: Record<string, string> = {
      'low': 'low',
      'medium': 'recommended', 
      'high': 'extreme',
    };
    const compressionLevel = compressionMap[level] || 'recommended';

    // If no API keys, fall back to pdf-lib
    if (!ILOVEPDF_PUBLIC_KEY || !ILOVEPDF_SECRET_KEY) {
      console.log('No iLovePDF keys, using pdf-lib fallback');
      return await compressWithPdfLib(file);
    }

    console.log('Using iLovePDF SDK with compression level:', compressionLevel);
    console.log('Public key:', ILOVEPDF_PUBLIC_KEY?.substring(0, 20) + '...');

    // Try using the iLovePDF SDK
    try {
      const { default: ILovePDFApi } = await import('@ilovepdf/ilovepdf-js');
      const instance = new ILovePDFApi(ILOVEPDF_PUBLIC_KEY);
      
      const task = instance.newTask('compress');
      
      // Start the task
      await task.start();
      
      // Add the file - convert to base64 or use URL approach
      const fileBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(fileBuffer).toString('base64');
      const dataUrl = `data:application/pdf;base64,${base64}`;
      
      await task.addFile(dataUrl);
      
      // Process with compression level
      await task.process({ compression_level: compressionLevel });
      
      // Download the result
      const result = await task.download();
      
      // Convert Uint8Array to Buffer
      const buffer = Buffer.from(result);
      
      const originalSize = fileBuffer.byteLength;
      const compressedSize = buffer.length;
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

      console.log('iLovePDF SDK compression:', originalSize, '->', compressedSize, '(' + compressionRatio + '%)');

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="compressed_${file.name}"`,
          'X-Original-Size': originalSize.toString(),
          'X-Compressed-Size': compressedSize.toString(),
          'X-Compression-Ratio': compressionRatio,
        },
      });
    } catch (sdkError) {
      console.error('iLovePDF SDK error:', sdkError);
      console.log('Falling back to pdf-lib');
      return await compressWithPdfLib(file);
    }

  } catch (error) {
    console.error('Compression error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { error: 'Failed to compress PDF. ' + errorMessage },
      { status: 500 }
    );
  }
}

// Fallback to pdf-lib compression
async function compressWithPdfLib(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const originalSize = arrayBuffer.byteLength;
  console.log('Using pdf-lib fallback, original size:', originalSize);

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  const compressedPdfBytes = await pdfDoc.save({
    useObjectStreams: true,
  });

  const buffer = Buffer.from(compressedPdfBytes);
  const compressedSize = buffer.length;
  const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

  console.log('pdf-lib compression:', originalSize, '->', compressedSize, '(' + compressionRatio + '%)');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="compressed_${file.name}"`,
      'X-Original-Size': originalSize.toString(),
      'X-Compressed-Size': compressedSize.toString(),
      'X-Compression-Ratio': compressionRatio,
    },
  });
}
