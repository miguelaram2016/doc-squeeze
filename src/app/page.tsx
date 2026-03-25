'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Check, CheckCircle, ChevronDown, Copy, Download, FileText, Files, Gauge, HardDrive, HelpCircle, Moon, Plus, RefreshCw, Scissors, Shield, Sparkles, Sun, Trash2, Upload, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toaster, toast } from 'sonner';
import { API_BASE_URL } from '@/lib/config';

type CompressionLevel = 'ultra' | 'high' | 'medium' | 'low' | 'minimal';
type FileStatus = 'pending' | 'compressing' | 'done' | 'error';
type AppState = 'upload' | 'processing' | 'result';

type CompressionResult = {
  originalName: string;
  originalSize: number;
  compressedSize: number;
  compressedBase64: string;
  compressedBlob?: Blob;
  error?: string;
};

type FileInfo = { id: string; name: string; size: number; originalSize: number; file: File };

const features = [
  { icon: Gauge, title: 'Simple controls', description: 'Pick a level, upload PDFs, and download each result.' },
  { icon: Shield, title: 'Temporary processing', description: 'Files are sent to the configured DocSqueeze API for processing.' },
  { icon: Sparkles, title: 'Honest trade-offs', description: 'Image-heavy PDFs usually shrink more than already-optimized text PDFs.' },
];

const faqs = [
  { question: 'How does compression work?', answer: 'This frontend uploads your files to the DocSqueeze API, which performs the compression server-side.' },
  { question: 'Is everything handled in the browser?', answer: 'No. This UI talks to a backend API. Do not assume fully local processing.' },
  { question: 'Will every PDF shrink a lot?', answer: 'No. Scanned or image-heavy PDFs usually shrink more than text-first documents that are already optimized.' },
  { question: 'Can I batch process files?', answer: 'Yes. Multiple PDFs can be uploaded and processed in one run, but each file is returned separately.' },
];

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / 1024 ** i).toFixed(2))} ${sizes[i]}`;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function Home() {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [healthRes, statsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/`, { cache: 'no-store' }),
          fetch(`${API_BASE_URL}/api/stats`, { cache: 'no-store' }).catch(() => null),
        ]);
        if (healthRes.ok) setIsServiceReady(true);
        if (statsRes?.ok) {
          const data = (await statsRes.json()) as { count?: number };
          setTotalProcessed(data.count ?? 0);
        }
      } catch {
        // noop
      } finally {
        setIsWarmingUp(false);
      }
    };
    void init();
  }, []);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    if (darkMode === undefined) return;
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const nextFiles = Array.from(fileList)
      .filter((file) => file.type === 'application/pdf')
      .map((file) => ({ id: generateId(), name: file.name, size: file.size, originalSize: file.size, file }));

    if (nextFiles.length > 0) {
      setFiles((prev) => [...prev, ...nextFiles]);
      toast.success(`${nextFiles.length} file(s) added`);
    }
  }, []);

  const handleCompress = () => {
    if (files.length === 0) return;

    setAppState('processing');
    setTotalProgress(0);

    const statuses = new Map<string, FileStatus>();
    const progress = new Map<string, number>();
    files.forEach((file) => {
      statuses.set(file.id, 'compressing');
      progress.set(file.id, 0);
    });
    setFileStatuses(statuses);
    setFileProgress(progress);

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file.file));
    formData.append('level', compressionLevel);

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const nextProgress = Math.min(Math.round((event.loaded / totalSize) * 55), 55);
      setTotalProgress(nextProgress);
      const perFile = new Map<string, number>();
      files.forEach((file) => perFile.set(file.id, nextProgress));
      setFileProgress(perFile);
    };

    xhr.onload = () => {
      setTotalProgress(100);
      const perFile = new Map<string, number>();
      files.forEach((file) => perFile.set(file.id, 100));
      setFileProgress(perFile);

      if (xhr.status !== 200) {
        toast.error('Compression failed');
        setAppState('upload');
        return;
      }

      try {
        const payload = JSON.parse(xhr.responseText) as { files: CompressionResult[] };
        const nextResults: CompressionResult[] = [];
        const nextStatuses = new Map<string, FileStatus>();

        payload.files.forEach((result) => {
          const fileId = files.find((file) => file.name === result.originalName)?.id ?? generateId();
          if (result.error) {
            nextStatuses.set(fileId, 'error');
            nextResults.push(result);
            return;
          }

          const byteCharacters = atob(result.compressedBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i += 1) byteNumbers[i] = byteCharacters.charCodeAt(i);
          nextStatuses.set(fileId, 'done');
          nextResults.push({ ...result, compressedBlob: new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' }) });
        });

        setResults(nextResults);
        setFileStatuses(nextStatuses);
        setAppState('result');
        toast.success(`${nextResults.filter((result) => !result.error).length} file(s) compressed`);
      } catch {
        toast.error('Could not parse compression response');
        setAppState('upload');
      }
    };

    xhr.onerror = () => {
      toast.error('Network error during compression');
      setAppState('upload');
    };

    xhr.open('POST', `${API_BASE_URL}/api/batch-compress`);
    xhr.send(formData);
  };

  const handleDownload = (result: CompressionResult) => {
    if (!result.compressedBlob) return;
    const url = URL.createObjectURL(result.compressedBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.originalName.replace(/\.pdf$/i, '_compressed.pdf');
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setFiles([]);
    setResults([]);
    setFileStatuses(new Map());
    setFileProgress(new Map());
    setTotalProgress(0);
    setAppState('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalSavings = results.reduce((sum, result) => sum + (result.originalSize - result.compressedSize || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <Toaster />
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><Zap className="w-5 h-5 text-white" /></div><div><h1 className="text-xl font-bold text-slate-900 dark:text-white">DocSqueeze</h1><p className="text-xs text-slate-500 dark:text-slate-400">PDF Toolkit</p></div></div>
          <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 overflow-x-auto">
            <Link href="/" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${pathname === '/' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}><Gauge className="w-4 h-4" /> Compress</Link>
            <Link href="/merge" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${pathname === '/merge' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}><Files className="w-4 h-4" /> Merge</Link>
            <Link href="/split" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${pathname === '/split' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}><Scissors className="w-4 h-4" /> Split</Link>
          </nav>
          <div className="flex items-center gap-3">
            {totalProcessed > 0 && <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-xs text-orange-700 dark:text-orange-400"><HardDrive className="w-3.5 h-3.5" /> {totalProcessed.toLocaleString()} processed</div>}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${isWarmingUp ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : isServiceReady ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{isWarmingUp ? 'Checking API...' : isServiceReady ? 'API ready' : 'API unavailable'}</div>
            <Button variant="ghost" size="icon" onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</Button>
          </div>
        </div>
      </header>

      <main>
        {appState === 'upload' && <div className="space-y-12 py-16"><div className="max-w-3xl mx-auto px-4 text-center space-y-6"><div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium"><Sparkles className="w-4 h-4" /> Free PDF compression with batch upload</div><h2 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight">Compress PDFs<br /><span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">with honest expectations</span></h2><p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Upload one or more PDFs, choose the level, and download each result separately. Savings depend heavily on the original file.</p></div>

          <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-3 gap-6">{features.map((feature) => <Card key={feature.title} className="border-0 shadow-lg"><CardContent className="p-6 text-center space-y-4"><div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center"><feature.icon className="w-7 h-7 text-violet-600 dark:text-violet-400" /></div><h3 className="text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h3><p className="text-slate-600 dark:text-slate-400">{feature.description}</p></CardContent></Card>)}</div>

          <div className="max-w-2xl mx-auto px-4">
            <Card className={`border-2 border-dashed ${isDragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
              <CardContent className="p-8">
                <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }} onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
                  <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple onChange={(e) => { addFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="hidden" />
                  {files.length === 0 && <div className="text-center py-6"><div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><Upload className="w-8 h-8 text-violet-600 dark:text-violet-400" /></div><p className="text-lg font-medium text-slate-900 dark:text-white mb-2">Drop your PDFs here</p><p className="text-slate-500 dark:text-slate-400">or click to browse — multiple files supported</p></div>}
                </div>

                {files.length > 0 && <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">{files.map((file) => { const status = fileStatuses.get(file.id) ?? 'pending'; const progress = fileProgress.get(file.id) ?? 0; const result = results.find((item) => item.originalName === file.name); const ratio = result && !result.error ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0; return <div key={file.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50"><div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><FileText className="w-5 h-5 text-red-600 dark:text-red-400" /></div><div className="flex-1 min-w-0"><p className="font-medium text-slate-900 dark:text-white truncate text-sm">{file.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{result && !result.error ? `${formatFileSize(result.compressedSize)} (${ratio}% smaller)` : formatFileSize(file.size)}</p>{status === 'compressing' && <Progress value={progress} className="h-1.5 mt-1.5" />}{result?.error && <p className="text-xs text-red-500 mt-1">{result.error}</p>}</div><div className="flex items-center gap-1">{status === 'done' && <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><Check className="w-4 h-4 text-green-600" /></div>}{status !== 'compressing' && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFiles((prev) => prev.filter((item) => item.id !== file.id))}><X className="w-3.5 h-3.5" /></Button>}</div></div>; })}</div>}
              </CardContent>
            </Card>
            <div className="flex items-center gap-3 mt-4"><Button variant="outline" size="sm" onClick={() => toast.info('Google Drive import is not implemented in this frontend yet.')} className="flex-1">Google Drive</Button><Button variant="outline" size="sm" onClick={() => toast.info('Dropbox import is not implemented in this frontend yet.')} className="flex-1">Dropbox</Button><Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}><Plus className="w-4 h-4" /></Button></div><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Cloud import buttons are placeholders right now.</p>

            {files.length > 0 && <Card className="mt-6"><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Compression settings</CardTitle><CardDescription>{files.length} file{files.length > 1 ? 's' : ''} selected</CardDescription></div><Button variant="ghost" size="sm" onClick={resetAll}><Trash2 className="w-4 h-4 mr-1" /> Clear all</Button></div></CardHeader><CardContent className="space-y-6"><div className="space-y-3"><Label>Compression level</Label><Select value={compressionLevel} onValueChange={(value) => setCompressionLevel(value as CompressionLevel)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ultra">Ultra — maximum compression</SelectItem><SelectItem value="high">High — aggressive</SelectItem><SelectItem value="medium">Medium — balanced</SelectItem><SelectItem value="low">Low — better quality</SelectItem><SelectItem value="minimal">Minimal — smallest change</SelectItem></SelectContent></Select><p className="text-sm text-slate-500 dark:text-slate-400">Higher compression usually means smaller files and more visible quality trade-offs.</p></div><Button onClick={handleCompress} className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"><Zap className="w-5 h-5 mr-2" />{files.length === 1 ? 'Compress PDF' : `Compress ${files.length} PDFs`}<ArrowRight className="w-5 h-5 ml-2" /></Button></CardContent></Card>}
          </div>

          <div className="max-w-3xl mx-auto px-4 py-12"><h3 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-8">Frequently asked questions</h3><div className="space-y-4">{faqs.map((faq, index) => <Card key={faq.question}><button className="w-full p-4 flex items-center justify-between text-left" onClick={() => setOpenFaq(openFaq === index ? null : index)}><span className="font-medium text-slate-900 dark:text-white flex items-center gap-3"><HelpCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" />{faq.question}</span><ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} /></button>{openFaq === index && <div className="px-4 pb-4 ml-8 text-slate-600 dark:text-slate-400">{faq.answer}</div>}</Card>)}</div></div></div>}

        {appState === 'processing' && <div className="max-w-2xl mx-auto px-4 py-24"><Card><CardContent className="p-8 text-center space-y-6"><div className="w-24 h-24 mx-auto rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><Zap className="w-10 h-10 text-violet-600 animate-pulse" /></div><div className="space-y-2"><h3 className="text-xl font-semibold text-slate-900 dark:text-white">Compressing your PDFs</h3><p className="text-slate-500 dark:text-slate-400">Processing happens on the API, so larger files can take longer.</p></div><Progress value={totalProgress} className="h-3" /><p className="text-sm font-medium text-violet-600 dark:text-violet-400">{totalProgress}%</p></CardContent></Card></div>}

        {appState === 'result' && results.length > 0 && <div className="space-y-8 py-16 max-w-2xl mx-auto px-4"><div className="text-center space-y-4"><div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" /></div><h2 className="text-3xl font-bold text-slate-900 dark:text-white">Compression complete</h2>{totalSavings > 0 && <p className="text-slate-500 dark:text-slate-400">Saved {formatFileSize(totalSavings)} total</p>}</div><div className="space-y-3">{results.map((result) => { const ratio = Math.round((1 - result.compressedSize / result.originalSize) * 100); return <Card key={result.originalName}><CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex items-center gap-3 flex-1 min-w-0"><div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><FileText className="w-5 h-5 text-red-600 dark:text-red-400" /></div><div className="min-w-0 flex-1"><p className="font-medium text-slate-900 dark:text-white truncate text-sm">{result.originalName}</p><p className="text-xs text-slate-500 dark:text-slate-400">{result.error ? result.error : `${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (${ratio}% smaller)`}</p></div></div>{!result.error && result.compressedBlob && <div className="flex items-center gap-2 ml-auto"><Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(result.originalName.replace(/\.pdf$/i, '_compressed.pdf')); setCopiedId(result.originalName); setTimeout(() => setCopiedId(null), 1500); }} >{copiedId === result.originalName ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}</Button><Button size="sm" onClick={() => handleDownload(result)}><Download className="w-3.5 h-3.5 mr-1" /> Download</Button></div>}</CardContent></Card>; })}</div><Button variant="outline" onClick={resetAll} className="w-full"><RefreshCw className="w-4 h-4 mr-2" /> Compress more files</Button></div>}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 mt-20"><div className="max-w-6xl mx-auto px-4 py-8 space-y-3"><div className="flex flex-col md:flex-row items-center justify-between gap-6"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div><span className="font-semibold text-slate-900 dark:text-white">DocSqueeze</span></div><div className="text-sm text-slate-500 dark:text-slate-400 text-center md:text-right">Privacy, terms, and contact pages are not published in this frontend yet.</div></div><p className="text-xs text-slate-400 dark:text-slate-500">API base URL: <code>{API_BASE_URL}</code>. Override with <code>NEXT_PUBLIC_DOCSQUEEZE_API_URL</code>.</p></div></footer>
    </div>
  );
}
