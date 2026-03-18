import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// iLovePDF API configuration  
const ILOVEPDF_PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY;
const ILOVEPDF_SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const level = formData.get('level') as string || 'recommended';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    // Map compression levels
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

    console.log('=== iLovePDF COMPRESSION ATTEMPT ===');
    console.log('Compression level:', compressionLevel);
    console.log('Public key starts with:', ILOVEPDF_PUBLIC_KEY?.substring(0, 15));

    const fileBuffer = await file.arrayBuffer();
    const originalSize = fileBuffer.byteLength;

    // Try iLovePDF REST API
    try {
      // Step 1: Request a JWT token from the auth endpoint
      console.log('Step 1: Requesting auth token...');
      const authResponse = await axios.post(
        'https://api.ilovepdf.com/v1/auth',
        { public_key: ILOVEPDF_PUBLIC_KEY },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      
      const token = authResponse.data.token;
      console.log('Auth response:', JSON.stringify(authResponse.data).substring(0, 200));

      // Step 2: Get server and task from iLovePDF using the token
      console.log('Step 2: Starting task...');
      const startResponse = await axios.get(
        'https://api.ilovepdf.com/v1/start/compress',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      console.log('Start response status:', startResponse.status);
      console.log('Start response data:', JSON.stringify(startResponse.data).substring(0, 200));
      
      const { server, task } = startResponse.data;

      // Step 3: Upload file to the server
      console.log('Step 3: Uploading file...');
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('file', Buffer.from(fileBuffer), { filename: file.name, contentType: 'application/pdf' });
      formData.append('task', task);

      const uploadResponse = await axios.post(
        `https://${server}/v1/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            ...formData.getHeaders(),
          },
        }
      );
      
      console.log('Upload response status:', uploadResponse.status);
      console.log('Upload response data:', JSON.stringify(uploadResponse.data).substring(0, 200));

      const { server_filename } = uploadResponse.data;

      // Step 4: Process the file
      console.log('Step 4: Processing...');
      const processResponse = await axios.post(
        `https://${server}/v1/process`,
        {
          task,
          tool: 'compress',
          files: [{
            server_filename,
            filename: file.name,
          }],
          compression_level: compressionLevel,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('Process response status:', processResponse.status);
      console.log('Process response data:', JSON.stringify(processResponse.data).substring(0, 200));

      // Step 5: Download the result
      console.log('Step 5: Downloading...');
      const downloadResponse = await axios.get(
        `https://${server}/v1/download/${task}`,
        {
          responseType: 'arraybuffer',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      console.log('Download response status:', downloadResponse.status);
      
      const compressedBuffer = Buffer.from(downloadResponse.data);
      const compressedSize = compressedBuffer.length;
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

      console.log('iLovePDF SUCCESS! Compression:', originalSize, '->', compressedSize, '(' + compressionRatio + '%)');

      return new NextResponse(compressedBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="compressed_${file.name}"`,
          'X-Original-Size': originalSize.toString(),
          'X-Compressed-Size': compressedSize.toString(),
          'X-Compression-Ratio': compressionRatio,
        },
      });

    } catch (apiError: any) {
      console.error('=== iLovePDF API ERROR ===');
      if (apiError.response) {
        console.error('Status:', apiError.response.status);
        console.error('Data:', JSON.stringify(apiError.response.data).substring(0, 500));
      } else if (apiError.request) {
        console.error('No response received:', apiError.message);
      } else {
        console.error('Error:', apiError.message);
      }
      console.log('Falling back to pdf-lib...');
      return await compressWithPdfLib(file);
    }

  } catch (error) {
    console.error('Compression error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to compress PDF. ' + errorMessage }, { status: 500 });
  }
}

// Fallback to pdf-lib compression
async function compressWithPdfLib(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const originalSize = arrayBuffer.byteLength;
  console.log('Using pdf-lib fallback, original size:', originalSize);

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  const compressedPdfBytes = await pdfDoc.save({ useObjectStreams: true });
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
