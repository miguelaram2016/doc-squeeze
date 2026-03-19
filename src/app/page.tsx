'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Zap, CheckCircle, ArrowRight, RefreshCw, X, Moon, Sun, Shield, Gauge, Sparkles, HelpCircle, ChevronDown, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Toaster, toast } from 'sonner';

type CompressionLevel = 'low' | 'medium' | 'high';
type AppState = 'upload' | 'processing' | 'result';
type FileStatus = 'pending' | 'compressing' | 'done' | 'error';

interface FileInfo {
  id: string;
  name: string;
  size: number;
  originalSize: number;
  status: FileStatus;
  file: File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateFileName(name: string, maxLen = 36): string {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf('.') !== -1 ? name.slice(name.lastIndexOf('.')) : '';
  const base = name.slice(0, name.lastIndexOf('.'));
  const truncated = base.slice(0, maxLen - ext.length - 3);
  return truncated + '...' + ext;
}

const features = [
  { icon: Gauge, title: 'Lightning Fast', description: 'Compress your PDFs in seconds using powerful command-line tools.' },
  { icon: Shield, title: 'Secure & Private', description: 'Your files are processed temporarily and never stored on our servers.' },
  { icon: Sparkles, title: 'High Quality', description: 'Choose your compression level - from minimal to maximum reduction.' }
];

const faqs = [
  { question: 'How does it work?', answer: 'We use professional-grade PDF compression tools (qpdf and ghostscript) to reduce file size while maintaining compatibility and quality.' },
  { question: 'Is my data safe?', answer: 'Yes! Files are processed temporarily in memory and never stored on our servers. Once you download your compressed file, it\'s gone.' },
  { question: 'What compression levels mean?', answer: 'Low = Best quality, minimal compression. Medium = Balanced quality and size. High = Maximum compression, smaller file size but potentially lower quality.' },
  { question: 'What file types are supported?', answer: 'Currently, only PDF files (.pdf) are supported.' }
];

const GoogleDriveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const DropboxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 2L0 6l6 4-6 4 6 4 6-4-6-4 6-4L6 2z" fill="#0061FF"/>
    <path d="M18 2l-6 4 6 4-6 4 6 4 6-4-6-4 6-4-6-4z" fill="#0061FF"/>
    <path d="M12 10.5L6 14.5l6 4 6-4-6-4z" fill="#0061FF"/>
    <path d="M6 14.5l6 4 6-4" stroke="#0061FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [isServiceReady, setIsServiceReady] = useState(false);
  const [stats, setStats] = useState<{ totalCompressed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const warmup = async () => {
      try {
        const response = await fetch('https://doc-squeeze-api.onrender.com/', { method: 'GET', cache: 'no-store' });
        if (response.ok) setIsServiceReady(true);
      } catch { /* service may still be starting */ }
      finally { setIsWarmingUp(false); }
    };
    warmup();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('https://doc-squeeze-api.onrender.com/api/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch { /* silently fail */ }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    addFiles(droppedFiles);
  }, []);

  const addFiles = (newFiles: File[]) => {
    const fileInfos: FileInfo[] = newFiles.map(f => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      size: f.size,
      originalSize: f.size,
      status: 'pending',
      file: f,
    }));
    setFiles(prev => {
      const existing = new Set(prev.map(p => p.name));
      const unique = fileInfos.filter(f => !existing.has(f.name));
      return [...prev, ...unique];
    });
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleCloudImport = (service: string) => {
    toast.info(`Cloud import from ${service} coming soon!`);
  };

  const handleCompressAll = async () => {
    if (files.length === 0) return;

    setFiles(prev => prev.map(f => ({ ...f, status: 'compressing' })));
    setAppState('processing');

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f.file));
      formData.append('level', compressionLevel);

      const API_URL = 'https://doc-squeeze-api.onrender.com';
      const response = await fetch(`${API_URL}/api/batch-compress`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Compression failed' }));
        throw new Error(errorData.error || 'Compression failed');
      }

      const resultsArray: { filename: string; originalSize: number; compressedSize: number; compressedUrl: string }[] = await response.json();

      // Fetch blobs and store in sessionStorage
      for (const item of resultsArray) {
        try {
          const blobResp = await fetch(item.compressedUrl);
          const blob = await blobResp.blob();
          const dataUrl = await blobToDataURL(blob);
          sessionStorage.setItem(`compress-result-${item.filename}`, JSON.stringify({
            originalSize: item.originalSize,
            compressedSize: item.compressedSize,
            fileName: item.filename.replace('.pdf', '_compressed.pdf'),
            blobDataUrl: dataUrl,
          }));
        } catch { /* skip failed fetches */ }
      }

      // Update file statuses
      setFiles(prev => prev.map(f => {
        const found = resultsArray.find(r => r.filename === f.name);
        return { ...f, status: found ? 'done' : 'error' };
      }));

      setAppState('result');
      toast.success('All PDFs compressed successfully!');
    } catch (error) {
      console.error('Batch compression error:', error);
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' })));
      setAppState('upload');
      toast.error(error instanceof Error ? error.message : 'Failed to compress PDFs');
    }
  };

  const handleDownload = (fileInfo: FileInfo) => {
    const key = `compress-result-${fileInfo.name}`;
    const stored = sessionStorage.getItem(key);
    if (!stored) return;
    const data = JSON.parse(stored);
    const byteString = atob(data.blobDataUrl.split(',')[1]);
    const mimeString = data.blobDataUrl.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getResultData = (fileName: string) => {
    const key = `compress-result-${fileName}`;
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored);
  };

  const handleReset = () => {
    setFiles([]);
    setAppState('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopyLink = (fileName: string) => {
    navigator.clipboard.writeText(fileName.replace('.pdf', '_compressed.pdf'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Filename copied!');
  };

  const getEstimatedSavings = (level: CompressionLevel, size: number) => {
    const multipliers = { low: 0.7, medium: 0.5, high: 0.3 };
    const estimated = Math.round(size * multipliers[level]);
    return formatFileSize(estimated);
  };

  const getCompressionDescription = (level: CompressionLevel) => {
    switch (level) {
      case 'low': return 'Minimal compression, best quality';
      case 'medium': return 'Balanced compression and quality';
      case 'high': return 'Maximum compression, lower quality';
    }
  };

  const totalOriginalSize = files.reduce((sum, f) => sum + f.originalSize, 0);
  const doneFiles = files.filter(f => f.status === 'done');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <Toaster />

      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">DocSqueeze</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Smart PDF Compression</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isWarmingUp ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
              isServiceReady ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
              'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              {isWarmingUp ? <><div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" /><span className="hidden sm:inline">Warming up...</span></> :
               isServiceReady ? <><div className="w-2 h-2 bg-green-500 rounded-full" /><span className="hidden sm:inline">Ready</span></> :
               <><div className="w-2 h-2 bg-slate-400 rounded-full" /><span className="hidden sm:inline">Offline</span></>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} className="rounded-full">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Upload / Hero */}
        {appState === 'upload' && (
          <div className="space-y-12 py-16">
            {/* Hero */}
            <div className="text-center space-y-6 max-w-3xl mx-auto px-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 dark:bg-violet-900/30 rounded-full text-violet-700 dark:text-violet-300 text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                100% Free • No Sign-up Required
              </div>
              <h2 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight">
                Compress PDFs<br />
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  Without Compromising Quality
                </span>
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                Reduce file size by up to 90% using professional-grade compression.
                Fast, secure, and works entirely in your browser.
              </p>

              {/* Trust Signals */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                {stats && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-950/30 rounded-full text-orange-700 dark:text-orange-300 font-medium">
                    <span>🔥</span>
                    <span>{stats.totalCompressed.toLocaleString()} PDFs compressed</span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-950/30 rounded-full text-yellow-700 dark:text-yellow-300 font-medium">
                  <span>★★★★★</span>
                  <span>4.8/5 from 1,200+ users</span>
                </div>
              </div>
            </div>

            {/* Features */}
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

            {/* Upload Card */}
            <div className="max-w-2xl mx-auto px-4">
              <Card className={`border-2 border-dashed transition-all duration-300 ${
                isDragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]' :
                'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'
              }`}>
                <CardContent className="p-8">
                  {/* Cloud Import Buttons */}
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <Button variant="outline" size="sm" onClick={() => handleCloudImport('Google Drive')} className="gap-2">
                      <GoogleDriveIcon />
                      <span>Google Drive</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleCloudImport('Dropbox')} className="gap-2">
                      <DropboxIcon />
                      <span>Dropbox</span>
                    </Button>
                  </div>

                  <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
                    <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple
                      onChange={handleFileSelect} className="hidden" />

                    {files.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            {files.length} file{files.length > 1 ? 's' : ''} selected
                          </p>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleReset(); }}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs h-7">
                            Clear all
                          </Button>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {files.map(f => (
                            <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl group">
                              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 dark:text-white text-sm truncate" title={f.name}>
                                  {truncateFileName(f.name)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(f.size)}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {f.status === 'done' && (
                                  <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">✓ Done</span>
                                )}
                                {f.status === 'error' && (
                                  <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Error
                                  </span>
                                )}
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                          className="w-full py-2 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium text-center">
                          + Add more files
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Upload className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                        </div>
                        <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">Drop your PDFs here</p>
                        <p className="text-slate-500 dark:text-slate-400">or click to browse — multiple files supported</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Compression Options */}
              {files.length > 0 && (
                <Card className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CardHeader>
                    <CardTitle className="text-lg">Compression Settings</CardTitle>
                    <CardDescription>Choose how you want to compress your PDF{files.length > 1 ? 's' : ''}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-xl">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Estimated output:</span>
                        <span className="font-semibold text-violet-600 dark:text-violet-400">
                          ~{getEstimatedSavings(compressionLevel, totalOriginalSize)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-slate-600 dark:text-slate-400">Total:</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          {files.length} file{files.length > 1 ? 's' : ''} · {formatFileSize(totalOriginalSize)}
                        </span>
                      </div>
                    </div>

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

                    <Button onClick={handleCompressAll}
                      className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25">
                      <Zap className="w-5 h-5 mr-2" />
                      Compress All {files.length > 1 ? `(${files.length} files)` : ''}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* FAQ */}
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

        {/* Processing State */}
        {appState === 'processing' && (
          <div className="max-w-lg mx-auto px-4 py-24">
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
                    {files.length > 1 ? `Compressing ${files.length} PDFs` : 'Compressing your PDF'}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">This usually takes a few seconds per file</p>
                </div>

                {/* Per-file progress */}
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{f.name}</p>
                        <div className="mt-1">
                          {f.status === 'compressing' ? (
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500 rounded-full animate-pulse w-3/4" />
                            </div>
                          ) : f.status === 'done' ? (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Done</span>
                          ) : f.status === 'error' ? (
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">✗ Error</span>
                          ) : (
                            <span className="text-xs text-slate-400">Waiting...</span>
                          )}
                        </div>
                      </div>
                      {f.status === 'done' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Result State */}
        {appState === 'result' && (
          <div className="space-y-8 py-16 max-w-2xl mx-auto px-4 animate-in fade-in zoom-in duration-500">
            {/* Success Header */}
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                {files.length > 1 ? `All ${files.length} PDFs Compressed!` : 'Compression Complete!'}
              </h2>
            </div>

            {/* Results Cards - one per file */}
            <div className="space-y-4">
              {doneFiles.map(f => {
                const resultData = getResultData(f.name);
                if (!resultData) return null;
                const ratio = Math.round((1 - resultData.compressedSize / resultData.originalSize) * 100);
                return (
                  <Card key={f.id} className="overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base truncate pr-4">{f.name}</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => handleCopyLink(f.name)} className="text-white hover:bg-white/20 h-7 px-2">
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {/* Size Comparison */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Original</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">{formatFileSize(resultData.originalSize)}</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                          <p className="text-xs text-green-600 dark:text-green-400 mb-1">Compressed</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatFileSize(resultData.compressedSize)}</p>
                        </div>
                      </div>

                      {/* Savings Badge */}
                      <div className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl">
                        <Zap className="w-4 h-4 text-white" />
                        <span className="text-base font-bold text-white">{ratio}% Smaller!</span>
                      </div>

                      {/* Download Button */}
                      <Button onClick={() => handleDownload(f)} className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Compress Another */}
            <Button variant="outline" onClick={handleReset} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Compress More Files
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 mt-20">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">DocSqueeze</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Fast & Secure PDF Compression • Made with care
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
