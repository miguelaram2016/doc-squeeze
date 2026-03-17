'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Zap, CheckCircle, ArrowRight, RefreshCw, X, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
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
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Check for API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const res = await fetch('/api/compress', { method: 'HEAD' });
      } catch (e) {
        // Ignore
      }
    };
    checkApiKey();
  }, []);

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
      setFile({
        name: droppedFile.name,
        size: droppedFile.size,
        originalSize: droppedFile.size,
      });
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile({
        name: selectedFile.name,
        size: selectedFile.size,
        originalSize: selectedFile.size,
      });
    }
  }, []);

  const handleCompress = async () => {
    if (!file) return;

    setAppState('processing');
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const formData = new FormData();
      const fileInput = fileInputRef.current;
      if (fileInput?.files?.[0]) {
        formData.append('file', fileInput.files[0]);
      } else {
        throw new Error('No file selected');
      }
      formData.append('level', compressionLevel);

      const response = await fetch('/api/compress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Compression failed' }));
        throw new Error(errorData.error || 'Compression failed');
      }

      const blob = await response.blob();
      const compressedSize = blob.size;

      clearInterval(progressInterval);
      setProgress(100);

      setResult({
        originalSize: file.originalSize,
        compressedSize,
        compressedBlob: blob,
        fileName: file.name.replace('.pdf', '_compressed.pdf'),
      });

      setAppState('result');
    } catch (error) {
      console.error('Compression error:', error);
      clearInterval(progressInterval);
      setAppState('upload');
      toast.error(error instanceof Error ? error.message : 'Failed to compress PDF. Please check your API key.');
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
        return 'Minimal compression, best quality';
      case 'medium':
        return 'Balanced compression and quality';
      case 'high':
        return 'Maximum compression, lower quality';
    }
  };

  const compressionRatio = result 
    ? Math.round((1 - result.compressedSize / result.originalSize) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <Toaster />
      
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">DocSqueeze</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Smart PDF Compression</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
            className="rounded-full"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Upload State */}
        {appState === 'upload' && (
          <div className="space-y-8">
            {/* Hero */}
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                Compress PDFs with Ease
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Reduce file size while maintaining quality. Fast, secure, and completely free.
              </p>
            </div>

            {/* Dropzone */}
            <Card className={`border-2 border-dashed transition-all duration-300 ${
              isDragging 
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]' 
                : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'
            }`}>
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
                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{file.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReset();
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                      </div>
                      <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        Drop your PDF here
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        or click to browse files
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Compression Options (shown when file is selected) */}
            {file && (
              <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader>
                  <CardTitle className="text-lg">Compression Settings</CardTitle>
                  <CardDescription>Choose how you want to compress your PDF</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Compression Level */}
                  <div className="space-y-3">
                    <Label>Compression Level</Label>
                    <Select value={compressionLevel} onValueChange={(v) => setCompressionLevel(v as CompressionLevel)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Low</span>
                            <span className="text-slate-500 text-sm">- Best quality</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Medium</span>
                            <span className="text-slate-500 text-sm">- Balanced</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">High</span>
                            <span className="text-slate-500 text-sm">- Max compression</span>
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
                    className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25"
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Compress PDF
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Processing State */}
        {appState === 'processing' && (
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 bg-violet-100 dark:bg-violet-900/30 rounded-full animate-pulse" />
                <div className="relative w-full h-full flex items-center justify-center">
                  <Zap className="w-10 h-10 text-violet-600 animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Compressing your PDF
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  This usually takes a few seconds
                </p>
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">{progress}%</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result State */}
        {appState === 'result' && result && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            {/* Success Header */}
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                Compression Complete!
              </h2>
            </div>

            {/* Results Card */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                <CardTitle>Compression Results</CardTitle>
                <CardDescription className="text-violet-100">
                  {result.fileName}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Size Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Original</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatFileSize(result.originalSize)}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                    <p className="text-sm text-green-600 dark:text-green-400 mb-1">Compressed</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatFileSize(result.compressedSize)}
                    </p>
                  </div>
                </div>

                {/* Savings Badge */}
                <div className="flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl">
                  <Zap className="w-5 h-5 text-white" />
                  <span className="text-xl font-bold text-white">
                    {compressionRatio}% Smaller!
                  </span>
                </div>

                {/* Download Button */}
                <Button 
                  onClick={handleDownload}
                  className="w-full h-14 text-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download Compressed PDF
                </Button>

                {/* Compress Another */}
                <Button 
                  variant="outline"
                  onClick={handleReset}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Compress Another File
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 mt-20">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>DocSqueeze - Fast & Secure PDF Compression</p>
        </div>
      </footer>
    </div>
  );
}
