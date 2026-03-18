import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

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

    // Get file buffer
    const arrayBuffer = await file.arrayBuffer();
    const originalSize = arrayBuffer.byteLength;
    console.log('Original file size:', originalSize);

    // Load the PDF
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    // Save with compression
    // useObjectStreams: true compresses the PDF by using object streams
    const compressedPdfBytes = await pdfDoc.save({
      useObjectStreams: true,
    });

    const compressedSize = compressedPdfBytes.byteLength;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    console.log('Compressed size:', compressedSize);
    console.log('Compression ratio:', compressionRatio + '%');

    // Convert Uint8Array to Buffer for NextResponse
    const buffer = Buffer.from(compressedPdfBytes);

    return new NextResponse(buffer, {
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
