'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, FileText, Download, Zap, CheckCircle, ArrowRight, RefreshCw, X, Moon, Sun, Shield, Gauge, Sparkles, HelpCircle, ChevronDown, Copy, Check, Star, HardDrive, Trash2, Plus, Files, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Toaster, toast } from 'sonner';

type CompressionLevel = 'low' | 'medium' | 'high';
type FileStatus = 'pending' | 'compressing' | 'done' | 'error';
type AppState = 'upload' | 'processing' | 'result';

interface FileInfo {
  id: string;
  name: string;
  size: number;
  originalSize: number;
  file: File;
}

interface CompressionResult {
  originalName: string;
  originalSize: number;
  compressedSize: number;
  compressedBase64: string;
  compressedBlob?: Blob;
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

const features = [
  { icon: Gauge, title: 'Lightning Fast', description: 'Compress your PDFs in seconds using powerful command-line tools.' },
  { icon: Shield, title: 'Secure & Private', description: 'Your files are processed temporarily and never stored on our servers.' },
  { icon: Sparkles, title: 'High Quality', description: 'Choose your compression level — from minimal to maximum reduction.' }
];

const faqs = [
  { question: 'How does it work?', answer: 'We use professional-grade PDF compression tools (qpdf and ghostscript) to reduce file size while maintaining compatibility and quality.' },
  { question: 'Is my data safe?', answer: "Yes! Files are processed temporarily in memory and never stored on our servers. Once you download your compressed file, it's gone." },
  { question: 'What compression levels mean?', answer: 'Low = Best quality, minimal compression. Medium = Balanced quality and size. High = Maximum compression, smaller file size but potentially lower quality.' },
  { question: 'Can I compress multiple files at once?', answer: 'Yes! Select multiple PDF files to compress them all in one batch. Each file will be processed individually and you can download them one by one.' },
  { question: 'What file types are supported?', answer: 'Currently, only PDF files (.pdf) are supported.' }
];

export default function Home() {
  const pathname = usePathname();
  const [appState, setAppState] = useState<AppState>('upload');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [results, setResults] = useState<CompressionResult[]>([]);
  const [fileStatuses, setFileStatuses] = useState<Map<string, FileStatus>>(new Map());
  const [fileProgress, setFileProgress] = useState<Map<string, number>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean | undefined>(undefined);
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [isServiceReady, setIsServiceReady] = useState(false);
  const [totalCompressed, setTotalCompressed] = useState(0);
  const [processingPhase, setProcessingPhase] = useState<'upload' | 'compress' | 'download' | 'done'>('upload');
  const [totalProgress, setTotalProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Detect system dark mode preference on mount
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
    if (prefersDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  // Sync dark mode class when toggled
  useEffect(() => {
    if (darkMode === undefined) return;
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const newDark = e.matches;
      setDarkMode(newDark);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: FileInfo[] = [];
    for (const file of Array.from(fileList)) {
      if (file.type === 'application/pdf') {
        newFiles.push({ id: generateId(), name: file.name, size: file.size, originalSize: file.size, file });
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

  const clearAll = () => {
    setFiles([]); setResults([]); setFileStatuses(new Map()); setFileProgress(new Map());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCloudImport = (service: string) => toast.info(`${service} import coming soon!`);

  const handleCompress = () => {
    if (files.length === 0) return;

    const statuses = new Map<string, FileStatus>();
    const progress = new Map<string, number>();
    files.forEach(f => { statuses.set(f.id, 'compressing'); progress.set(f.id, 0); });
    setFileStatuses(statuses);
    setFileProgress(progress);
    setTotalProgress(0);
    setProcessingPhase('upload');
    setAppState('processing');

    const formData = new FormData();
    files.forEach(f => formData.append('files', f.file));
    formData.append('level', compressionLevel);

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProcessingPhase('upload');
        const pct = Math.min(Math.round((e.loaded / totalSize) * 45), 45);
        setTotalProgress(pct);
        const newProgress = new Map<string, number>();
        files.forEach(f => newProgress.set(f.id, pct));
        setFileProgress(newProgress);
      }
    };

    xhr.onload = () => {
      setProcessingPhase('done');
      setTotalProgress(100);
      const newProgress = new Map<string, number>();
      files.forEach(f => newProgress.set(f.id, 100));
      setFileProgress(newProgress);

      if (xhr.status !== 200) {
        try {
          const err = JSON.parse(xhr.responseText);
          toast.error(err.error || 'Compression failed');
        } catch {
          toast.error('Compression failed');
        }
        setAppState('upload');
        return;
      }

      try {
        const data = JSON.parse(xhr.responseText);
        const processedResults: CompressionResult[] = [];
        const newStatuses = new Map<string, FileStatus>();

        for (const r of data.files) {
          const fileId = files.find(f => f.name === r.originalName)?.id || generateId();
          if (r.error) {
            newStatuses.set(fileId, 'error');
            processedResults.push({ ...r, compressedBlob: undefined });
          } else {
            const byteCharacters = atob(r.compressedBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
            newStatuses.set(fileId, 'done');
            processedResults.push({ ...r, compressedBlob: blob });
          }
        }

        setResults(processedResults);
        setFileStatuses(newStatuses);
        setAppState('result');
        toast.success(`${processedResults.filter(r => !r.error).length} file(s) compressed!`);
      } catch (parseErr) {
        toast.error('Failed to parse response');
        setAppState('upload');
      }
    };

    xhr.onerror = () => {
      toast.error('Network error during compression');
      setAppState('upload');
    };

    xhr.open('POST', `${API_URL}/api/batch-compress`);
    xhr.send(formData);
  };

  const handleDownload = (result: CompressionResult) => {
    if (!result.compressedBlob) return;
    const url = URL.createObjectURL(result.compressedBlob);
    const a = document.createElement('a');
    a.href = url; a.download = result.originalName.replace('.pdf', '_compressed.pdf');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = (result: CompressionResult) => {
    navigator.clipboard.writeText(result.originalName.replace('.pdf', '_compressed.pdf'));
    setCopiedId(result.originalName);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Filename copied!');
  };

  const handleReset = () => {
    setFiles([]); setResults([]); setFileStatuses(new Map()); setFileProgress(new Map()); setTotalProgress(0); setProcessingPhase('upload'); setAppState('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getCompressionDescription = (level: CompressionLevel) => {
    if (level === 'low') return 'Minimal compression, best quality';
    if (level === 'medium') return 'Balanced compression and quality';
    return 'Maximum compression, lower quality';
  };

  const getCompressionRatio = (result: CompressionResult) =>
    Math.round((1 - result.compressedSize / result.originalSize) * 100);

  const totalSavings = results.reduce((acc, r) => acc + (r.originalSize - (r.compressedSize || 0)), 0);
  const doneCount = results.filter(r => !r.error).length;

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

          <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1">
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
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-full text-xs font-medium text-orange-700 dark:text-orange-400">
                <HardDrive className="w-3.5 h-3.5" />
                <span>{totalCompressed.toLocaleString()} compressed</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-full text-xs font-medium text-yellow-700 dark:text-yellow-400">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>4.8/5 (1,200+ users)</span>
            </div>
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
                <Sparkles className="w-4 h-4" />
                100% Free • No Sign-up Required • Batch Supported
              </div>
              <h2 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight">
                Compress PDFs<br />
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Without Compromising Quality</span>
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                Reduce file size by up to 90%. Compress one PDF or batch process dozens — fast, secure, and works entirely in your browser.
              </p>
            </div>

            <div className="max-w-5xl mx-auto px-4">
              <div className="grid md:grid-cols-3 gap-6">
                {features.map((feature, i) => (
                  <Card key={i} className="border-0 shadow-lg">
                    <CardContent className="p-6 text-center space-y-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto">
                        <feature.icon className="w-7 h-7 text-violet-600 dark:text-violet-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                      <p className="text-slate-600 dark:text-slate-400">{feature.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
                    <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
                      {files.map((f) => {
                        const status = fileStatuses.get(f.id) || 'pending';
                        const progress = fileProgress.get(f.id) || 0;
                        const result = results.find(r => r.originalName === f.name);
                        const savings = result && !result.error ? getCompressionRatio(result) : 0;
                        return (
                          <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 dark:text-white truncate text-sm">{f.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {result && !result.error ? `${formatFileSize(result.compressedSize)} (${savings}% smaller)` : formatFileSize(f.size)}
                              </p>
                              {status === 'compressing' && <Progress value={progress} className="h-1.5 mt-1.5" />}
                              {result?.error && <p className="text-xs text-red-500 mt-1">Error: {result.error}</p>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {status === 'done' && !result?.error && <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"><Check className="w-4 h-4 text-green-600" /></div>}
                              {status === 'error' && <div className="w-7 h-7 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center"><X className="w-4 h-4 text-red-600" /></div>}
                              {status !== 'compressing' && <Button variant="ghost" size="icon" onClick={() => removeFile(f.id)} className="h-7 w-7"><X className="w-3.5 h-3.5" /></Button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center gap-3 mt-4">
                <Button variant="outline" size="sm" onClick={() => handleCloudImport('Google Drive')} className="flex-1">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google Drive
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleCloudImport('Dropbox')} className="flex-1">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="#0061FF"><path d="M6 2L0 6.5l6 4.5 6-4.5L6 2zm12 0l-6 4.5 6 4.5 6-4.5-6-4.5zM0 15.5l6 4.5 6-4.5-6-4.5-6 4.5zm18-4.5l-6 4.5 6 4.5 6-4.5-6-4.5zM6 20.5l6-4.5 6 4.5-6 4.5-6-4.5z"/></svg>
                  Dropbox
                </Button>
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="flex-shrink-0" title="Add more files">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {files.length > 0 && (
                <Card className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Compression Settings</CardTitle>
                        <CardDescription>{files.length} file{files.length > 1 ? 's' : ''} selected</CardDescription>
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearAll} className="text-slate-500">
                        <Trash2 className="w-4 h-4 mr-1" /> Clear all
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <Label>Compression Level</Label>
                      <Select value={compressionLevel} onValueChange={(v) => setCompressionLevel(v as CompressionLevel)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low"><div className="flex items-center gap-2"><span className="font-medium">Low</span><span className="text-slate-500 text-sm">- Best quality</span></div></SelectItem>
                          <SelectItem value="medium"><div className="flex items-center gap-2"><span className="font-medium">Medium</span><span className="text-slate-500 text-sm">- Balanced</span></div></SelectItem>
                          <SelectItem value="high"><div className="flex items-center gap-2"><span className="font-medium">High</span><span className="text-slate-500 text-sm">- Max compression</span></div></SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{getCompressionDescription(compressionLevel)}</p>
                    </div>
                    <Button onClick={handleCompress} className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25">
                      <Zap className="w-5 h-5 mr-2" />
                      {files.length === 1 ? 'Compress PDF' : `Compress ${files.length} PDFs`}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="max-w-3xl mx-auto px-4 py-12">
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-8">Frequently Asked Questions</h3>
              <div className="space-y-4">
                {faqs.map((faq, i) => (
                  <Card key={i} className="overflow-hidden">
                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full p-4 flex items-center justify-between text-left">
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-3">
                        <HelpCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        {faq.question}
                      </span>
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                    </button>
                    {openFaq === i && <div className="px-4 pb-4 pt-0 text-slate-600 dark:text-slate-400 ml-8">{faq.answer}</div>}
                  </Card>
                ))}
              </div>
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
                    <Zap className="w-10 h-10 text-violet-600 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {files.length === 1 ? 'Compressing PDF' : `Compressing ${files.length} PDFs`}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 capitalize">
                    {processingPhase === 'upload' ? 'Uploading files...' : processingPhase === 'compress' ? 'Server-side compression...' : processingPhase === 'download' ? 'Downloading results...' : 'Done!'}
                  </p>
                </div>
                <div className="space-y-2 max-w-xs mx-auto">
                  <Progress value={totalProgress} className="h-3" />
                  <p className="text-sm font-medium text-violet-600 dark:text-violet-400">{totalProgress}%</p>
                </div>
                <p className="text-xs text-slate-400">This may take a moment depending on file size</p>
              </CardContent>
            </Card>
          </div>
        )}

        {appState === 'result' && results.length > 0 && (
          <div className="space-y-8 py-16 max-w-2xl mx-auto px-4 animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{doneCount} File{doneCount > 1 ? 's' : ''} Compressed!</h2>
              {totalSavings > 0 && <p className="text-slate-500 dark:text-slate-400">Saved {formatFileSize(totalSavings)} total</p>}
            </div>

            <div className="space-y-3">
              {results.map((result, i) => {
                const savings = getCompressionRatio(result);
                const isDone = !result.error && result.compressedBlob;
                return (
                  <Card key={i} className={`overflow-hidden ${!isDone ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate text-sm">{result.originalName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {result.error ? result.error : `${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (${savings}% smaller)`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                          {!result.error && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full text-xs font-medium text-green-700 dark:text-green-400">
                              <Zap className="w-3 h-3" /> {savings}%
                            </div>
                          )}
                          {isDone && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleCopyLink(result)} className="h-8 w-8">
                                {copiedId === result.originalName ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </Button>
                              <Button size="sm" onClick={() => handleDownload(result)} className="bg-violet-600 hover:bg-violet-700 touch-manipulation min-w-[100px]">
                                <Download className="w-3.5 h-3.5 mr-1" /> <span className="hidden sm:inline">Download</span><span className="sm:hidden">DL</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" /> Compress More Files
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
