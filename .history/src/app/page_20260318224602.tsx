'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  Download,
  Zap,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  X,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Toaster, toast } from 'sonner';

type CompressionLevel = 'low' | 'medium' | 'high';
type AppState = 'upload' | 'processing' | 'result';

interface FileInfo {
  name: string;
  size: number;
  originalSize: number;
}

interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressedBlob: Blob;
  fileName: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [file, setFile] = useState<FileInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];

    if (droppedFile && droppedFile.type === 'application/pdf') {
      setSelectedFile(droppedFile);
      setFile({
        name: droppedFile.name,
        size: droppedFile.size,
        originalSize: droppedFile.size,
      });
    } else {
      toast.error('Please upload a PDF file');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];

    if (selected && selected.type === 'application/pdf') {
      setSelectedFile(selected);
      setFile({
        name: selected.name,
        size: selected.size,
        originalSize: selected.size,
      });
    } else if (selected) {
      toast.error('Please upload a PDF file');
    }
  }, []);

  const handleCompress = async () => {
    if (!file || !selectedFile) return;

    setAppState('processing');
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 80) return 80;
        return prev + 10;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('level', compressionLevel);

      const response = await fetch('/api/compress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Compression failed');
      }

      const compressedBlob = await response.blob();

      clearInterval(progressInterval);
      setProgress(100);

      setResult({
        originalSize: file.originalSize,
        compressedSize: compressedBlob.size,
        compressedBlob,
        fileName: file.name.replace(/\.pdf$/i, '_compressed.pdf'),
      });

      setAppState('result');
      toast.success('PDF compressed successfully!');
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Compression error:', error);
      setAppState('upload');
      toast.error(error instanceof Error ? error.message : 'Failed to compress PDF');
    }
  };

  const handleDownload = () => {
    if (!result) return;

    const url = URL.createObjectURL(result.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setSelectedFile(null);
    setResult(null);
    setProgress(0);
    setAppState('upload');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getCompressionDescription = (level: CompressionLevel) => {
    switch (level) {
      case 'low':
        return 'Lighter compression, better quality';
      case 'medium':
        return 'Balanced compression and quality';
      case 'high':
        return 'Maximum compression, lower quality';
      default:
        return 'Balanced compression and quality';
    }
  };

  const compressionRatio =
    result && result.originalSize > 0
      ? Math.round((1 - result.compressedSize / result.originalSize) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <Toaster />

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">DocSqueeze</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Native PDF Compression</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
            className="rounded-full"
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        {appState === 'upload' && (
          <div className="space-y-8">
            <div className="space-y-4 text-center">
              <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                Compress PDFs with Ease
              </h2>
              <p className="mx-auto max-w-md text-lg text-slate-600 dark:text-slate-400">
                Reduce PDF file size using a native backend pipeline. Better compression than
                browser-only rewriting.
              </p>
            </div>

            <Card
              className={`border-2 border-dashed transition-all duration-300 ${
                isDragging
                  ? 'scale-[1.02] border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                  : 'border-slate-200 hover:border-violet-300 dark:border-slate-700 dark:hover:border-violet-600'
              }`}
            >
              <CardContent className="p-8">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {file ? (
                    <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                        <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900 dark:text-white">
                          {file.name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReset();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
                        <Upload className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                      </div>
                      <p className="mb-2 text-lg font-medium text-slate-900 dark:text-white">
                        Drop your PDF here
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">or click to browse files</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {file && (
              <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader>
                  <CardTitle className="text-lg">Compression Settings</CardTitle>
                  <CardDescription>
                    Choose how aggressively you want to compress your PDF
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>Compression Level</Label>

                    <Select
                      value={compressionLevel}
                      onValueChange={(v) => setCompressionLevel(v as CompressionLevel)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Low</span>
                            <span className="text-sm text-slate-500">- Better quality</span>
                          </div>
                        </SelectItem>

                        <SelectItem value="medium">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Medium</span>
                            <span className="text-sm text-slate-500">- Balanced</span>
                          </div>
                        </SelectItem>

                        <SelectItem value="high">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">High</span>
                            <span className="text-sm text-slate-500">- Smaller files</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {getCompressionDescription(compressionLevel)}
                    </p>
                  </div>

                  <Button
                    onClick={handleCompress}
                    className="h-12 w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-base shadow-lg shadow-violet-500/25 hover:from-violet-700 hover:to-indigo-700"
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    Compress PDF
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {appState === 'processing' && (
          <Card className="mx-auto max-w-md">
            <CardContent className="space-y-6 p-8 text-center">
              <div className="relative mx-auto h-24 w-24">
                <div className="absolute inset-0 animate-pulse rounded-full bg-violet-100 dark:bg-violet-900/30" />
                <div className="relative flex h-full w-full items-center justify-center">
                  <Zap className="h-10 w-10 animate-pulse text-violet-600" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Compressing your PDF
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Processing through the server-side native toolchain
                </p>
              </div>

              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">{progress}%</p>
              </div>
            </CardContent>
          </Card>
        )}

        {appState === 'result' && result && (
          <div className="animate-in fade-in zoom-in space-y-8 duration-500">
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                Compression Complete!
              </h2>
            </div>

            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                <CardTitle>Compression Results</CardTitle>
                <CardDescription className="text-violet-100">{result.fileName}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800/50">
                    <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">Original</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatFileSize(result.originalSize)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-green-50 p-4 text-center dark:bg-green-900/20">
                    <p className="mb-1 text-sm text-green-600 dark:text-green-400">Compressed</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatFileSize(result.compressedSize)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 p-4">
                  <Zap className="h-5 w-5 text-white" />
                  <span className="text-xl font-bold text-white">{compressionRatio}% Smaller!</span>
                </div>

                <Button
                  onClick={handleDownload}
                  className="h-14 w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-lg shadow-lg shadow-violet-500/25 hover:from-violet-700 hover:to-indigo-700"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download Compressed PDF
                </Button>

                <Button variant="outline" onClick={handleReset} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Compress Another File
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>DocSqueeze - Native PDF Compression with qpdf + Ghostscript</p>
        </div>
      </footer>
    </div>
  );
}