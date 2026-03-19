'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, FileText, Download, Zap, CheckCircle, RefreshCw, X, Moon, Sun, Gauge, Sparkles, Scissors, HardDrive, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Toaster, toast } from 'sonner';

type AppState = 'upload' | 'processing' | 'result';
type SplitMode = 'all' | 'custom';

interface SplitResult {
  splitBlob?: Blob;
  error?: string;
}

const API_URL = 'https://doc-squeeze-api.onrender.com';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function SplitPage() {
  const pathname = usePathname();
  const [appState, setAppState] = useState<AppState>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [splitMode, setSplitMode] = useState<SplitMode>('all');
  const [pageRange, setPageRange] = useState<string>('');
  const [splitResult, setSplitResult] = useState<SplitResult>({});
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean | undefined>(undefined);
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [isServiceReady, setIsServiceReady] = useState(false);
  const [totalCompressed, setTotalCompressed] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [healthRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/stats`, { cache: 'no-store' }).catch(() => null)
        ]);
        if (healthRes.ok) setIsServiceReady(true);
        if (statsRes?.ok) {
          const data = await statsRes.json();
          setTotalCompressed(data.count || 0);
        }
      } catch { /* silent */ }
      finally { setIsWarmingUp(false); }
    };
    init();
  }, []);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
    if (prefersDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    if (darkMode === undefined) return;
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (file.type === 'application/pdf') {
      setSelectedFile({ id: generateId(), name: file.name, size: file.size, file } as any);
      setFileName(file.name);
      setFileSize(file.size);
      toast.success('File selected');
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }, [addFiles]);
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { addFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; }, [addFiles]);

  const removeFile = () => {
    setSelectedFile(null);
    setFileName('');
    setFileSize(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAll = () => {
    setSelectedFile(null);
    setFileName('');
    setFileSize(0);
    setPageRange('');
    setSplitResult({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSplit = async () => {
    if (!selectedFile) {
      toast.error('Please select a PDF file');
      return;
    }

    if (splitMode === 'custom' && !pageRange.trim()) {
      toast.error('Please enter page ranges (e.g., 1-3, 4, 5-7)');
      return;
    }

    setAppState('processing');
    setProcessingProgress(0);

    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => Math.min(prev + 8, 85));
    }, 300);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile as any);
      formData.append('mode', splitMode);
      if (splitMode === 'custom') {
        formData.append('ranges', pageRange.trim());
      }

      const response = await fetch(`${API_URL}/api/split`, { method: 'POST', body: formData });

      clearInterval(progressInterval);
      setProcessingProgress(100);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Split failed' }));
        throw new Error(errorData.error || 'Split failed');
      }

      const blob = await response.blob();
      setSplitResult({ splitBlob: blob });
      setAppState('result');
      toast.success('PDF split successfully!');
    } catch (error) {
      setSplitResult({ error: error instanceof Error ? error.message : 'Failed to split PDF' });
      setAppState('upload');
      toast.error(error instanceof Error ? error.message : 'Failed to split PDF');
    }
  };

  const handleDownload = () => {
    if (!splitResult.splitBlob) return;
    const url = URL.createObjectURL(splitResult.splitBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace('.pdf', '_split.pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileName('');
    setFileSize(0);
    setPageRange('');
    setSplitResult({});
    setAppState('upload');
    setProcessingProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getOutputFilename = () => {
    return fileName.replace('.pdf', '_split.pdf');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <Toaster />

      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">DocSqueeze</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">PDF Toolkit</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 overflow-x-auto scrollbar-hide -mx-2 px-2">
            <Link href="/" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === '/' ? 'bg-white dark:bg-slate-700 shadow-sm text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
              <Gauge className="w-4 h-4" /> Compress
            </Link>
            <Link href="/merge" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === '/merge' ? 'bg-white dark:bg-slate-700 shadow-sm text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
              <Sparkles className="w-4 h-4" /> Merge
            </Link>
            <Link href="/split" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === '/split' ? 'bg-white dark:bg-slate-700 shadow-sm text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
              <Scissors className="w-4 h-4" /> Split
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {totalCompressed > 0 && (
              <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-full text-xs font-medium text-orange-700 dark:text-orange-400">
                <HardDrive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{totalCompressed.toLocaleString()} compressed</span>
                <span className="sm:hidden">{totalCompressed.toLocaleString()}</span>
              </div>
            )}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isWarmingUp ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : isServiceReady ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {isWarmingUp ? <><div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" /><span className="hidden sm:inline">Warming up...</span></> : isServiceReady ? <><div className="w-2 h-2 bg-green-500 rounded-full" /><span className="hidden sm:inline">Ready</span></> : <><div className="w-2 h-2 bg-slate-400 rounded-full" /><span className="hidden sm:inline">Offline</span></>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} className="rounded-full">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main>
        {appState === 'upload' && (
          <div className="space-y-12 py-16">
            <div className="text-center space-y-6 max-w-3xl mx-auto px-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 dark:bg-violet-900/30 rounded-full text-violet-700 dark:text-violet-300 text-sm font-medium">
                <Scissors className="w-4 h-4" />
                Extract specific pages from any PDF
              </div>
              <h2 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight">
                Split PDFs<br />
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Page by Page</span>
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                Extract all pages as separate PDFs, or select a custom range of pages to keep.
              </p>
            </div>

            <div className="max-w-2xl mx-auto px-4">
              <Card className={`border-2 border-dashed transition-all duration-300 ${isDragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'}`}>
                <CardContent className="p-8">
                  <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
                    <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileSelect} className="hidden" />
                    {!selectedFile && (
                      <div className="text-center py-4">
                        <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Upload className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                        </div>
                        <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">Drop your PDF here</p>
                        <p className="text-slate-500 dark:text-slate-400">or click to browse — single file only</p>
                      </div>
                    )}
                  </div>

                  {selectedFile && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate text-sm">{fileName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(fileSize)}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={removeFile} className="h-7 w-7 flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedFile && (
                <Card className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Split Settings</CardTitle>
                        <CardDescription>Choose how to split your PDF</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <Label>Split Mode</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setSplitMode('all')}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${splitMode === 'all' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Scissors className="w-4 h-4 text-violet-600" />
                            <span className="font-medium text-slate-900 dark:text-white text-sm">All Pages</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Keep every page from the PDF</p>
                        </button>
                        <button
                          onClick={() => setSplitMode('custom')}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${splitMode === 'custom' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-4 h-4 text-violet-600" />
                            <span className="font-medium text-slate-900 dark:text-white text-sm">Custom Range</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Pick specific pages or ranges</p>
                        </button>
                      </div>
                    </div>

                    {splitMode === 'custom' && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label htmlFor="pageRange">Page Ranges</Label>
                        <input
                          id="pageRange"
                          type="text"
                          value={pageRange}
                          onChange={(e) => setPageRange(e.target.value)}
                          placeholder="e.g., 1-3, 4, 5-7"
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Enter page numbers or ranges separated by commas. Example: 1-3, 4, 5-7 extracts pages 1 through 3, page 4, and pages 5 through 7.
                        </p>
                      </div>
                    )}

                    <Button onClick={handleSplit} className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25">
                      <Scissors className="w-5 h-5 mr-2" />
                      Split PDF
                      <Zap className="w-5 h-5 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {appState === 'processing' && (
          <div className="max-w-2xl mx-auto px-4 py-24">
            <Card>
              <CardContent className="p-8 text-center space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 bg-violet-100 dark:bg-violet-900/30 rounded-full animate-pulse" />
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Splitting your PDF</h3>
                  <p className="text-slate-500 dark:text-slate-400">Extracting pages — this may take a moment</p>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </CardContent>
            </Card>
          </div>
        )}

        {appState === 'result' && splitResult.splitBlob && (
          <div className="space-y-8 py-16 max-w-2xl mx-auto px-4 animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">PDF Split!</h2>
              <p className="text-slate-500 dark:text-slate-400">Your split PDF is ready to download</p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-7 h-7 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{getOutputFilename()}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{formatFileSize(splitResult.splitBlob.size)}</p>
                  </div>
                  <Button onClick={handleDownload} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25 touch-manipulation">
                    <Download className="w-4 h-4 mr-2" /> Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" /> Split More Files
              </Button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 mt-20">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">DocSqueeze</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                <span>© {new Date().getFullYear()} DocSqueeze. All rights reserved.</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#" className="text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Privacy Policy</a>
              <a href="#" className="text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Terms of Service</a>
              <a href="#" className="text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
