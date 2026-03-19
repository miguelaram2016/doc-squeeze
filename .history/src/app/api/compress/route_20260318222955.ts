import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

async function runQpdf(input: string, output: string) {
  await execFileAsync('qpdf', [
    '--linearize',
    '--object-streams=generate',
    input,
    output,
  ]);
}

async function runGhostscript(input: string, output: string, level: string) {
  const qualityMap: Record<string, string> = {
    low: '/printer',
    medium: '/ebook',
    high: '/screen',
  };

  const quality = qualityMap[level] || '/ebook';

  await execFileAsync('gs', [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    '-dPDFSETTINGS=' + quality,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    `-sOutputFile=${output}`,
    input,
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const level = (formData.get('level') as string) || 'medium';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docsqueeze-'));
    const inputPath = path.join(tmpDir, 'input.pdf');
    const qpdfPath = path.join(tmpDir, 'qpdf.pdf');
    const outputPath = path.join(tmpDir, 'output.pdf');

    await fs.writeFile(inputPath, buffer);

    // Step 1: lossless optimization
    await runQpdf(inputPath, qpdfPath);

    // Step 2: real compression
    await runGhostscript(qpdfPath, outputPath, level);

    const result = await fs.readFile(outputPath);

    return new NextResponse(result, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compressed_${file.name}"`,
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || 'Compression failed' },
      { status: 500 }
    );
  }
}