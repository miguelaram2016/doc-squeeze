'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, FileText, Download, Zap, CheckCircle, RefreshCw, X, Moon, Sun, Gauge, Sparkles, Files, Scissors, ArrowUp, ArrowDown, Trash2, HardDrive, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Toaster, toast } from 'sonner';

type AppState = 'upload' | 'processing' | 'result';

interface FileInfo {
  id: string;
  name: string;
  size: number;
  file: File;
}

interface MergeResult {
  mergedBlob?: Blob;
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

export default function MergePage() {
  const pathname = usePathname();
  const [appState, setAppState] = useState<AppState>('upload');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [mergeResult, setMergeResult] = useState<MergeResult>({});
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
    if (!fileList) return;
    const newFiles: FileInfo[] = [];
    for (const file of Array.from(fileList)) {
      if (file.type === 'application/pdf') {
        newFiles.push({ id: generateId(), name: file.name, size: file.size, file });
      }
    }
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) added`);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }, [addFiles]);
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { addFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; }, [addFiles]);

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const moveFileUp = (index: number) => {
    if (index === 0) return;
    setFiles(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveFileDown = (index: number) => {
    if (index === files.length - 1) return;
    setFiles(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const clearAll = () => {
    setFiles([]); setMergeResult({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast.error('Please add at least 2 PDF files to merge');
      return;
    }

    setAppState('processing');
    setProcessingProgress(0);

    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => Math.min(prev + 8, 85));
    }, 300);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f.file));

      const response = await fetch(`${API_URL}/api/merge`, { method: 'POST', body: formData });

      clearInterval(progressInterval);
      setProcessingProgress(100);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Merge failed' }));
        throw new Error(errorData.error || 'Merge failed');
      }

      const blob = await response.blob();
      setMergeResult({ mergedBlob: blob });
      setAppState('result');
      toast.success('PDFs merged successfully!');
    } catch (error) {
      setMergeResult({ error: error instanceof Error ? error.message : 'Failed to merge PDFs' });
      setAppState('upload');
      toast.error(error instanceof Error ? error.message : 'Failed to merge PDFs');
    }
  };

  const handleDownload = () => {
    if (!mergeResult.mergedBlob) return;
    const url = URL.createObjectURL(mergeResult.mergedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merged_document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFiles([]); setMergeResult({}); setAppState('upload'); setProcessingProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

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
              <Files className="w-4 h-4" /> Merge
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
                <Files className="w-4 h-4" />
                Combine multiple PDFs into one
              </div>
              <h2 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight">
                Merge PDFs<br />
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Fast & Simple</span>
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                Select multiple PDFs and merge them into a single document. Reorder files using the arrow buttons.
              </p>
            </div>

            <div className="max-w-2xl mx-auto px-4">
              <Card className={`border-2 border-dashed transition-all duration-300 ${isDragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'}`}>
                <CardContent className="p-8">
                  <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
                    <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple onChange={handleFileSelect} className="hidden" />
                    {files.length === 0 && (
                      <div className="text-center py-4">
                        <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Upload className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                        </div>
                        <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">Drop your PDFs here</p>
                        <p className="text-slate-500 dark:text-slate-400">or click to browse — select multiple files at once</p>
                      </div>
                    )}
                  </div>

                  {files.length > 0 && (
                    <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium px-1">Files will be merged in the order shown below — use ↑↓ to reorder</p>
                      {files.map((f, index) => (
                        <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center flex-shrink-0 text-violet-600 dark:text-violet-400 font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate text-sm">{f.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(f.size)}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => moveFileUp(index)} disabled={index === 0} className="h-7 w-7">
                              <ArrowUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => moveFileDown(index)} disabled={index === files.length - 1} className="h-7 w-7">
                              <ArrowDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => removeFile(f.id)} className="h-7 w-7">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center gap-3 mt-4">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex-1">
                  <Plus className="w-4 h-4 mr-2" /> Add More Files
                </Button>
              </div>

              {files.length > 1 && (
                <Card className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Merge Settings</CardTitle>
                        <CardDescription>{files.length} files • {formatFileSize(totalSize)} total</CardDescription>
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearAll} className="text-slate-500">
                        <Trash2 className="w-4 h-4 mr-1" /> Clear all
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Merge order</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        Files will be merged in the order shown above (1 → 2 → 3...). Use the arrow buttons to reorder.
                      </p>
                    </div>
                    <Button onClick={handleMerge} className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25">
                      <Files className="w-5 h-5 mr-2" />
                      Merge {files.length} PDFs
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
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Merging your PDFs</h3>
                  <p className="text-slate-500 dark:text-slate-400">Combining {files.length} files — this may take a moment</p>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </CardContent>
            </Card>
          </div>
        )}

        {appState === 'result' && mergeResult.mergedBlob && (
          <div className="space-y-8 py-16 max-w-2xl mx-auto px-4 animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">PDFs Merged!</h2>
              <p className="text-slate-500 dark:text-slate-400">Your merged PDF is ready to download</p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-7 h-7 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">merged_document.pdf</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{formatFileSize(mergeResult.mergedBlob.size)}</p>
                  </div>
                  <Button onClick={handleDownload} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25 touch-manipulation">
                    <Download className="w-4 h-4 mr-2" /> Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" /> Merge More Files
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
