import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// iLovePDF API configuration  
const ILOVEPDF_PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY;

export async function POST(request: NextRequest) {
  const debugLogs: string[] = [];

  const log = (msg: string) => {
    debugLogs.push(msg);
    console.log(msg);
  };

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

    // If no API key, fall back to pdf-lib
    if (!ILOVEPDF_PUBLIC_KEY) {
      log('No iLovePDF public key, using pdf-lib fallback');
      return await compressWithPdfLib(file);
    }

    log('=== iLovePDF COMPRESSION ATTEMPT ===');
    log('Compression level: ' + compressionLevel);

    const fileBuffer = await file.arrayBuffer();
    const originalSize = fileBuffer.byteLength;
    log('File size: ' + originalSize);

    // Try iLovePDF REST API
    try {
      // Step 1: Request a JWT token using public key only
      log('Step 1: Requesting auth token (public key only)...');
      const authResponse = await axios.post(
        'https://api.ilovepdf.com/v1/auth',
        { public_key: ILOVEPDF_PUBLIC_KEY },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      
      const token = authResponse.data.token;
      log('Auth success, token: ' + token?.substring(0, 30) + '...');

      // Step 2: Get server and task
      log('Step 2: Starting task...');
      const startResponse = await axios.get(
        'https://api.ilovepdf.com/v1/start/compress/us',
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      
      const { server, task } = startResponse.data;
      log('Server: ' + server + ', Task: ' + task);

      // Step 3: Upload file
      log('Step 3: Uploading...');
      const uploadFormData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      uploadFormData.append('file', blob, file.name);
      uploadFormData.append('task', task);

      const uploadResponse = await axios.post(
        `https://${server}/v1/upload`,
        uploadFormData,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      
      const { server_filename } = uploadResponse.data;
      log('Upload success, filename: ' + server_filename);

      // Step 4: Process
      log('Step 4: Processing...');
      const processResponse = await axios.post(
        `https://${server}/v1/process`,
        {
          task,
          tool: 'compress',
          files: [{ server_filename }],
          compression_level: compressionLevel
        },
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      log('Process success!');

      // Step 5: Download
      log('Step 5: Downloading...');
      const downloadResponse = await axios.get(
        `https://${server}/v1/download/${task}`,
        {
          responseType: 'arraybuffer',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      
      const compressedBuffer = Buffer.from(downloadResponse.data);
      const compressedSize = compressedBuffer.length;
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

      log('iLovePDF SUCCESS! ' + originalSize + ' -> ' + compressedSize + ' (' + compressionRatio + '%)');

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
      log('=== iLovePDF ERROR ===');
      let errorMsg = 'Unknown error';
      if (apiError.response) {
        errorMsg = `Status ${apiError.response.status}: ${JSON.stringify(apiError.response.data).substring(0, 300)}`;
      } else if (apiError.request) {
        errorMsg = 'No response: ' + apiError.message;
      } else {
        errorMsg = apiError.message;
      }
      log(errorMsg);
      
      // Fall back to pdf-lib
      log('Falling back to pdf-lib...');
      return await compressWithPdfLib(file);
    }

  } catch (error) {
    log('Overall error: ' + (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ 
      error: 'Compression failed',
      debug: debugLogs 
    }, { status: 500 });
  }
}

async function compressWithPdfLib(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const originalSize = arrayBuffer.byteLength;

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  const compressedPdfBytes = await pdfDoc.save({ useObjectStreams: true });
  const buffer = Buffer.from(compressedPdfBytes);
  const compressedSize = buffer.length;
  const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

  console.log('pdf-lib: ' + originalSize + ' -> ' + compressedSize + ' (' + compressionRatio + '%)');

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
