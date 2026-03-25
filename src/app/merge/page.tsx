'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowDown, ArrowUp, CheckCircle, Download, FileText, Files, Gauge, HardDrive, Loader2, Moon, Plus, RefreshCw, Scissors, Sun, Trash2, Upload, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Toaster, toast } from 'sonner';
import { API_BASE_URL, getDownloadFilenameFromHeaders } from '@/lib/config';

type AppState = 'upload' | 'processing' | 'result';
type FileInfo = { id: string; name: string; size: number; file: File };

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / 1024 ** i).toFixed(2))} ${sizes[i]}`;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function MergePage() {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [appState, setAppState] = useState<AppState>('upload');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [downloadName, setDownloadName] = useState('merged_document.pdf');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [darkMode, setDarkMode] = useState<boolean | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [isServiceReady, setIsServiceReady] = useState(false);
  const [totalProcessed, setTotalProcessed] = useState(0);

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
      .map((file) => ({ id: generateId(), name: file.name, size: file.size, file }));
    if (nextFiles.length > 0) {
      setFiles((prev) => [...prev, ...nextFiles]);
      toast.success(`${nextFiles.length} file(s) added`);
    }
  }, []);

  const handleMerge = async () => {
    if (files.length < 2) {
      toast.error('Add at least 2 PDFs to merge');
      return;
    }

    setAppState('processing');
    setProcessingProgress(10);
    const interval = setInterval(() => setProcessingProgress((prev) => Math.min(prev + 8, 85)), 300);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file.file));
      const response = await fetch(`${API_BASE_URL}/api/merge`, { method: 'POST', body: formData });
      clearInterval(interval);
      setProcessingProgress(100);

      if (!response.ok) throw new Error('Merge failed');

      const blob = await response.blob();
      setMergedBlob(blob);
      setDownloadName(getDownloadFilenameFromHeaders(response.headers, 'merged_document.pdf'));
      setAppState('result');
      toast.success('PDFs merged');
    } catch (error) {
      clearInterval(interval);
      setAppState('upload');
      toast.error(error instanceof Error ? error.message : 'Merge failed');
    }
  };

  const resetAll = () => {
    setFiles([]);
    setMergedBlob(null);
    setDownloadName('merged_document.pdf');
    setProcessingProgress(0);
    setAppState('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800"><Toaster />
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50"><div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><Zap className="w-5 h-5 text-white" /></div><div><h1 className="text-xl font-bold text-slate-900 dark:text-white">DocSqueeze</h1><p className="text-xs text-slate-500 dark:text-slate-400">PDF Toolkit</p></div></div><nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 overflow-x-auto"><Link href="/" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${pathname === '/' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}><Gauge className="w-4 h-4" /> Compress</Link><Link href="/merge" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${pathname === '/merge' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}><Files className="w-4 h-4" /> Merge</Link><Link href="/split" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${pathname === '/split' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}><Scissors className="w-4 h-4" /> Split</Link></nav><div className="flex items-center gap-3">{totalProcessed > 0 && <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-xs text-orange-700 dark:text-orange-400"><HardDrive className="w-3.5 h-3.5" /> {totalProcessed.toLocaleString()} processed</div>}<div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${isWarmingUp ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : isServiceReady ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{isWarmingUp ? 'Checking API...' : isServiceReady ? 'API ready' : 'API unavailable'}</div><Button variant="ghost" size="icon" onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</Button></div></div></header>
      <main>
        {appState === 'upload' && <div className="space-y-12 py-16"><div className="max-w-3xl mx-auto px-4 text-center space-y-6"><div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium"><Files className="w-4 h-4" /> Merge PDFs in the order shown</div><h2 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight">Merge PDFs<br /><span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">without mystery steps</span></h2><p className="text-xl text-slate-600 dark:text-slate-400 max-w-xl mx-auto">Add at least two PDFs, reorder them, and download one merged output when the API finishes.</p></div><div className="max-w-2xl mx-auto px-4"><Card className={`border-2 border-dashed ${isDragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700'}`}><CardContent className="p-8"><div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }} onClick={() => fileInputRef.current?.click()} className="cursor-pointer"><input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple onChange={(e) => { addFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="hidden" />{files.length === 0 && <div className="text-center py-6"><div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><Upload className="w-8 h-8 text-violet-600 dark:text-violet-400" /></div><p className="text-lg font-medium text-slate-900 dark:text-white mb-2">Drop your PDFs here</p><p className="text-slate-500 dark:text-slate-400">or click to browse — multiple files supported</p></div>}</div>{files.length > 0 && <div className="mt-4 space-y-3 max-h-80 overflow-y-auto"><p className="text-xs text-slate-500 dark:text-slate-400">The list order becomes the merge order.</p>{files.map((file, index) => <div key={file.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50"><div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-sm">{index + 1}</div><div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><FileText className="w-5 h-5 text-red-600 dark:text-red-400" /></div><div className="flex-1 min-w-0"><p className="font-medium text-slate-900 dark:text-white truncate text-sm">{file.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => setFiles((prev) => { const next = [...prev]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}><ArrowUp className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === files.length - 1} onClick={() => setFiles((prev) => { const next = [...prev]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}><ArrowDown className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFiles((prev) => prev.filter((item) => item.id !== file.id))}><X className="w-3.5 h-3.5" /></Button></div></div>)}</div>}</CardContent></Card><div className="flex items-center gap-3 mt-4"><Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex-1"><Plus className="w-4 h-4 mr-2" /> Add more files</Button></div>{files.length > 1 && <Card className="mt-6"><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Merge settings</CardTitle><CardDescription>{files.length} files • {formatFileSize(files.reduce((sum, file) => sum + file.size, 0))} total</CardDescription></div><Button variant="ghost" size="sm" onClick={resetAll}><Trash2 className="w-4 h-4 mr-1" /> Clear all</Button></div></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-500 dark:text-slate-400">Output should be one merged PDF. If the backend sends a specific filename, the download button uses it.</p><Button onClick={handleMerge} className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"><Files className="w-5 h-5 mr-2" /> Merge {files.length} PDFs<Zap className="w-5 h-5 ml-2" /></Button></CardContent></Card>}</div></div>}
        {appState === 'processing' && <div className="max-w-2xl mx-auto px-4 py-24"><Card><CardContent className="p-8 text-center space-y-6"><div className="w-24 h-24 mx-auto rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><Loader2 className="w-10 h-10 text-violet-600 animate-spin" /></div><div className="space-y-2"><h3 className="text-xl font-semibold text-slate-900 dark:text-white">Merging your PDFs</h3><p className="text-slate-500 dark:text-slate-400">Processing happens on the API.</p></div><Progress value={processingProgress} className="h-2" /></CardContent></Card></div>}
        {appState === 'result' && mergedBlob && <div className="max-w-2xl mx-auto px-4 py-16 space-y-8"><div className="text-center space-y-4"><div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" /></div><h2 className="text-3xl font-bold text-slate-900 dark:text-white">PDFs merged</h2><p className="text-slate-500 dark:text-slate-400">Your merged file is ready.</p></div><Card><CardContent className="p-6 flex items-center gap-4"><div className="w-14 h-14 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><FileText className="w-7 h-7 text-red-600 dark:text-red-400" /></div><div className="flex-1 min-w-0"><p className="font-semibold text-slate-900 dark:text-white truncate">{downloadName}</p><p className="text-sm text-slate-500 dark:text-slate-400">{formatFileSize(mergedBlob.size)}</p></div><Button onClick={() => { const url = URL.createObjectURL(mergedBlob); const a = document.createElement('a'); a.href = url; a.download = downloadName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }}><Download className="w-4 h-4 mr-2" /> Download</Button></CardContent></Card><Button variant="outline" onClick={resetAll} className="w-full"><RefreshCw className="w-4 h-4 mr-2" /> Merge more files</Button></div>}
      </main>
      <footer className="border-t border-slate-200 dark:border-slate-800 mt-20"><div className="max-w-6xl mx-auto px-4 py-8 space-y-3"><div className="flex flex-col md:flex-row items-center justify-between gap-6"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div><span className="font-semibold text-slate-900 dark:text-white">DocSqueeze</span></div><div className="text-sm text-slate-500 dark:text-slate-400 text-center md:text-right">Privacy, terms, and contact pages are not published in this frontend yet.</div></div><p className="text-xs text-slate-400 dark:text-slate-500">API base URL: <code>{API_BASE_URL}</code>. Override with <code>NEXT_PUBLIC_DOCSQUEEZE_API_URL</code>.</p></div></footer>
    </div>
  );
}
