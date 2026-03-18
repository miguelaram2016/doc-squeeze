import { NextRequest, NextResponse } from 'next/server';

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

    // Step 1: Authenticate to get JWT token
    console.log('Authenticating...');
    const authResponse = await fetch('https://api.ilovepdf.com/v1/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ public_key: publicKey }),
    });

    console.log('Auth status:', authResponse.status, authResponse.statusText);
    
    if (!authResponse.ok) {
      const errText = await authResponse.text();
      console.error('Auth error:', errText);
      throw new Error(`Authentication failed: ${errText}`);
    }

    const authData = await authResponse.json();
    const token = authData.token;
    console.log('Got JWT token:', token.substring(0, 20) + '...');

    // Step 2: Start a new compress task
    console.log('Starting task...');
    const startResponse = await fetch('https://api.ilovepdf.com/v1/start/compress', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('Start task status:', startResponse.status, startResponse.statusText);
    
    if (!startResponse.ok) {
      const errText = await startResponse.text();
      console.error('Start task error:', errText);
      throw new Error(`Failed to start task: ${errText}`);
    }

    const taskData = await startResponse.json();
    console.log('Task started:', JSON.stringify(taskData));

    // Step 3: Upload the file using FormData
    const uploadUrl = `https://${taskData.server}/v1/upload`;
    console.log('Upload URL:', uploadUrl);
    
    const uploadFormData = new FormData();
    uploadFormData.append('task', taskData.task);
    uploadFormData.append('file', new Blob([arrayBuffer]), file.name);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: uploadFormData,
    });

    console.log('Upload status:', uploadResponse.status, uploadResponse.statusText);

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error('Upload error:', errText);
      throw new Error(`Failed to upload file: ${errText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('File uploaded:', JSON.stringify(uploadResult));

    // Step 4: Process the file
    const processUrl = `https://${taskData.server}/v1/process`;
    console.log('Process URL:', processUrl);
    const processResponse = await fetch(processUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: taskData.task,
        tool: 'compress',
        files: [{
          server_filename: uploadResult.server_filename,
          filename: file.name,
        }],
        compression_level: compressionLevel,
      }),
    });

    console.log('Process status:', processResponse.status, processResponse.statusText);

    if (!processResponse.ok) {
      const errText = await processResponse.text();
      console.error('Process error:', errText);
      throw new Error(`Failed to process file: ${errText}`);
    }

    const processResult = await processResponse.json();
    console.log('Processing complete:', JSON.stringify(processResult));

    // Step 5: Download the result
    const downloadUrl = `https://${taskData.server}/v1/download/${taskData.task}`;
    console.log('Download URL:', downloadUrl);
    const downloadResponse = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!downloadResponse.ok) {
      const errText = await downloadResponse.text();
      console.error('Download error:', errText);
      throw new Error(`Failed to download result: ${errText}`);
    }

    const resultBuffer = await downloadResponse.arrayBuffer();

    return new NextResponse(resultBuffer, {
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
