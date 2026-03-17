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

    // Get API key from environment
    const apiKey = process.env.ILOVEPDF_API_KEY;
    
    console.log('API Key present:', !!apiKey);
    console.log('API Key value:', apiKey ? apiKey.substring(0, 10) + '...' : 'missing');
    
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

    // Get file buffer
    const arrayBuffer = await file.arrayBuffer();

    // iLovePDF REST API - Create task
    // Step 1: Create a new compress task
    console.log('Creating task...');
    const createTaskResponse = await fetch('https://api.ilovepdf.com/v1/work', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tool: 'compress' }),
    });

    console.log('Create task status:', createTaskResponse.status, createTaskResponse.statusText);
    
    if (!createTaskResponse.ok) {
      const errText = await createTaskResponse.text();
      console.error('Create task error:', errText);
      throw new Error(`Failed to create task: ${errText}`);
    }

    const taskData = await createTaskResponse.json();
    console.log('Task created:', JSON.stringify(taskData));

    // Step 2: Upload the file using FormData
    const uploadUrl = taskData.server + '/upload';
    console.log('Upload URL:', uploadUrl);
    
    const uploadFormData = new FormData();
    uploadFormData.append('task', taskData.task);
    uploadFormData.append('file', new Blob([arrayBuffer]), file.name);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: uploadFormData,
    });

    console.log('Upload status:', uploadResponse.status, uploadResponse.statusText);

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error('Upload error:', errText);
      throw new Error(`Failed to upload file: ${errText}`);
    }

    const uploadData = await uploadResponse.json();
    console.log('File uploaded:', JSON.stringify(uploadData));

    // Step 3: Process the file
    const processUrl = taskData.server + '/process';
    console.log('Process URL:', processUrl);
    const processResponse = await fetch(processUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: taskData.task,
        compression_level: compressionLevel,
      }),
    });

    if (!processResponse.ok) {
      const errText = await processResponse.text();
      console.error('Process error:', errText);
      throw new Error(`Failed to process file: ${errText}`);
    }

    const processData = await processResponse.json();
    console.log('Processing complete:', processData);

    // Step 4: Download the result
    const downloadResponse = await fetch(taskData.server + '/download/' + taskData.task, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
    
    // More detailed error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { error: 'Failed to compress PDF. ' + errorMessage },
      { status: 500 }
    );
  }
}
