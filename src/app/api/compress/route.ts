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

    console.log('Using iLovePDF API with compression level:', compressionLevel);

    // Try iLovePDF REST API with direct key authentication
    // Step 1: Start task
    const startResponse = await fetch('https://api.ilovepdf.com/v1/start/compress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ILOVEPDF_PUBLIC_KEY}:${ILOVEPDF_SECRET_KEY}`,
      },
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error('iLovePDF start error:', startResponse.status, errorText);
      // Fall back to pdf-lib
      console.log('Falling back to pdf-lib');
      return await compressWithPdfLib(file);
    }

    const startData = await startResponse.json();
    console.log('Start response:', startData);

    const { server, task } = startData;

    // Step 2: Upload file
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    const uploadFormData = new FormData();
    const blob = new Blob([fileBuffer]);
    uploadFormData.append('file', blob, file.name);
    uploadFormData.append('task', task);

    const uploadResponse = await fetch(`https://${server}/v1/upload`, {
      method: 'POST',
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('iLovePDF upload error:', uploadResponse.status, errorText);
      return await compressWithPdfLib(file);
    }

    const uploadData = await uploadResponse.json();
    console.log('Upload response:', uploadData);

    // Step 3: Process
    const processResponse = await fetch(`https://${server}/v1/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task,
        tool: 'compress',
        compression_level: compressionLevel,
        files: [{
          server_filename: uploadData.server_filename,
          filename: file.name,
        }],
      }),
    });

    if (!processResponse.ok) {
      const errorText = await processResponse.text();
      console.error('iLovePDF process error:', processResponse.status, errorText);
      return await compressWithPdfLib(file);
    }

    const processData = await processResponse.json();
    console.log('Process response:', processData);

    // Step 4: Download
    const downloadResponse = await fetch(`https://${server}/v1/download/${task}`, {
      method: 'GET',
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      console.error('iLovePDF download error:', downloadResponse.status, errorText);
      return await compressWithPdfLib(file);
    }

    const compressedBuffer = await downloadResponse.arrayBuffer();
    const originalSize = fileBuffer.length;
    const compressedSize = compressedBuffer.byteLength;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

    console.log('iLovePDF compression:', originalSize, '->', compressedSize, '(' + compressionRatio + '%)');

    return new NextResponse(compressedBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compressed_${file.name}"`,
        'X-Original-Size': originalSize.toString(),
        'X-Compressed-Size': compressedSize.toString(),
        'X-Compression-Ratio': compressionRatio,
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
