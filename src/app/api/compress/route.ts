import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const level = formData.get('level') as string || 'medium';
    const quality = parseInt(formData.get('quality') as string || '70', 10);

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

    // Read the file
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    // Get all pages
    const pages = pdfDoc.getPages();
    
    // Compression is limited in pdf-lib, but we can:
    // 1. Remove unused objects
    // 2. Flatten forms
    // 3. Compress images if present
    
    // For now, we'll do basic optimization
    // In production, you'd use a more robust solution
    
    // Save with compression options
    // Note: pdf-lib's save options are limited
    // The actual compression ratio depends on the PDF content
    
    const compressedPdf = await pdfDoc.save({
      useObjectStreams: true,
    });

    // Create blob - copy to ensure proper ArrayBuffer
    const pdfBuffer = new Uint8Array(compressedPdf);
    const blob = new Blob([pdfBuffer.buffer], { type: 'application/pdf' });

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compressed.pdf"`,
      },
    });
  } catch (error) {
    console.error('Compression error:', error);
    return NextResponse.json(
      { error: 'Failed to compress PDF' },
      { status: 500 }
    );
  }
}
