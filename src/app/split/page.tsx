'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle, Download, FileText, Files, Gauge, HardDrive, Loader2, Moon, RefreshCw, Scissors, Sparkles, Sun, Upload, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Toaster, toast } from 'sonner';
import { API_BASE_URL, getDownloadFilenameFromHeaders } from '@/lib/config';

type AppState = 'upload' | 'processing' | 'result';
type SplitMode = 'all' | 'custom';

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / 1024 ** i).toFixed(2))} ${sizes[i]}`;
}

export default function SplitPage() {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [appState, setAppState] = useState<AppState>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageRange, setPageRange] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('all');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [downloadName, setDownloadName] = useState('split-output.zip');
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

  const addFile = useCallback((fileList: FileList | null) => {
    if (!fileList?.length) return;
    const file = fileList[0];
    if (file.type !== 'application/pdf') return;
    setSelectedFile(file);
    toast.success('File selected');
  }, []);

  const handleSplit = async () => {
    if (!selectedFile) {
      toast.error('Select a PDF first');
      return;
    }
    if (splitMode === 'custom' && !pageRange.trim()) {
      toast.error('Enter page ranges like 1-3, 4, 5-7');
      return;
    }

    setAppState('processing');
    setProcessingProgress(10);
    const interval = setInterval(() => setProcessingProgress((prev) => Math.min(prev + 8, 85)), 300);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile, selectedFile.name);
      formData.append('mode', splitMode);
      if (splitMode === 'custom') formData.append('ranges', pageRange.trim());
      const response = await fetch(`${API_BASE_URL}/api/split`, { method: 'POST', body: formData });
      clearInterval(interval);
      setProcessingProgress(100);
      if (!response.ok) throw new Error('Split failed');
      const blob = await response.blob();
      const fallback = splitMode === 'all' ? selectedFile.name.replace(/\.pdf$/i, '_pages.zip') : selectedFile.name.replace(/\.pdf$/i, '_selection.pdf');
      setResultBlob(blob);
      setDownloadName(getDownloadFilenameFromHeaders(response.headers, fallback));
      setAppState('result');
      toast.success('PDF split complete');
    } catch (error) {
      clearInterval(interval);
      setAppState('upload');
      toast.error(error instanceof Error ? error.message : 'Split failed');
    }
  };

  const resetAll = () => {
    setSelectedFile(null);
    setPageRange('');
    setSplitMode('all');
    setResultBlob(null);
    setDownloadName('split-output.zip');
    setProcessingProgress(0);
    setAppState('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800"><Toaster />
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50"><div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><Zap className="w-5 h-5 text-white" /></div><div><h1 className="text-xl font-bold text-slate-900 dark:text-white">DocSqueeze</h1><p className="text-xs text-slate-500 dark:text-slate-400">PDF Toolkit</p></div></div><nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 overflow-x-auto"><Link href="/" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${pathname === '/' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}><Gauge className="w-4 h-4" /> Compress</Link><Link href="/merge" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${pathname === '/merge' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}><Files className="w-4 h-4" /> Merge</Link><Link href="/split" className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${pathname === '/split' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}><Scissors className="w-4 h-4" /> Split</Link></nav><div className="flex items-center gap-3">{totalProcessed > 0 && <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-xs text-orange-700 dark:text-orange-400"><HardDrive className="w-3.5 h-3.5" /> {totalProcessed.toLocaleString()} processed</div>}<div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${isWarmingUp ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : isServiceReady ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{isWarmingUp ? 'Checking API...' : isServiceReady ? 'API ready' : 'API unavailable'}</div><Button variant="ghost" size="icon" onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</Button></div></div></header>
      <main>
        {appState === 'upload' && <div className="space-y-12 py-16"><div className="max-w-3xl mx-auto px-4 text-center space-y-6"><div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium"><Scissors className="w-4 h-4" /> Split one PDF into all pages or a custom range</div><h2 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight">Split PDFs<br /><span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">with honest output labels</span></h2><p className="text-xl text-slate-600 dark:text-slate-400 max-w-xl mx-auto">All Pages usually returns a ZIP of single-page PDFs. Custom Range usually returns one PDF containing only the pages you kept.</p></div><div className="max-w-2xl mx-auto px-4"><Card className={`border-2 border-dashed ${isDragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700'}`}><CardContent className="p-8"><div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFile(e.dataTransfer.files); }} onClick={() => fileInputRef.current?.click()} className="cursor-pointer"><input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={(e) => { addFile(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="hidden" />{!selectedFile && <div className="text-center py-6"><div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><Upload className="w-8 h-8 text-violet-600 dark:text-violet-400" /></div><p className="text-lg font-medium text-slate-900 dark:text-white mb-2">Drop your PDF here</p><p className="text-slate-500 dark:text-slate-400">or click to browse — single file only</p></div>}</div>{selectedFile && <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50"><div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><FileText className="w-5 h-5 text-red-600 dark:text-red-400" /></div><div className="flex-1 min-w-0"><p className="font-medium text-slate-900 dark:text-white truncate text-sm">{selectedFile.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(selectedFile.size)}</p></div><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedFile(null)}><X className="w-3.5 h-3.5" /></Button></div>}</CardContent></Card>{selectedFile && <Card className="mt-6"><CardHeader><CardTitle>Split settings</CardTitle><CardDescription>Choose the output you want</CardDescription></CardHeader><CardContent className="space-y-6"><div className="grid grid-cols-2 gap-3"><button onClick={() => setSplitMode('all')} className={`p-4 rounded-xl border-2 text-left ${splitMode === 'all' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700'}`}><div className="flex items-center gap-2 mb-1"><Scissors className="w-4 h-4 text-violet-600" /><span className="font-medium text-slate-900 dark:text-white text-sm">All pages</span></div><p className="text-xs text-slate-500 dark:text-slate-400">Usually downloads a ZIP of one-page PDFs</p></button><button onClick={() => setSplitMode('custom')} className={`p-4 rounded-xl border-2 text-left ${splitMode === 'custom' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700'}`}><div className="flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-violet-600" /><span className="font-medium text-slate-900 dark:text-white text-sm">Custom range</span></div><p className="text-xs text-slate-500 dark:text-slate-400">Usually returns one PDF with the selected pages</p></button></div>{splitMode === 'custom' && <div className="space-y-2"><Label htmlFor="pageRange">Page ranges</Label><input id="pageRange" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="e.g. 1-3, 4, 5-7" className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" /><p className="text-xs text-slate-500 dark:text-slate-400">Use commas between pages or ranges.</p></div>}<Button onClick={handleSplit} className="w-full h-12 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"><Scissors className="w-5 h-5 mr-2" /> Split PDF<Zap className="w-5 h-5 ml-2" /></Button></CardContent></Card>}</div></div>}
        {appState === 'processing' && <div className="max-w-2xl mx-auto px-4 py-24"><Card><CardContent className="p-8 text-center space-y-6"><div className="w-24 h-24 mx-auto rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><Loader2 className="w-10 h-10 text-violet-600 animate-spin" /></div><div className="space-y-2"><h3 className="text-xl font-semibold text-slate-900 dark:text-white">Splitting your PDF</h3><p className="text-slate-500 dark:text-slate-400">Processing happens on the API.</p></div><Progress value={processingProgress} className="h-2" /></CardContent></Card></div>}
        {appState === 'result' && resultBlob && <div className="max-w-2xl mx-auto px-4 py-16 space-y-8"><div className="text-center space-y-4"><div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" /></div><h2 className="text-3xl font-bold text-slate-900 dark:text-white">Split complete</h2><p className="text-slate-500 dark:text-slate-400">Your processed file is ready.</p></div><Card><CardContent className="p-6 flex items-center gap-4"><div className="w-14 h-14 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><FileText className="w-7 h-7 text-red-600 dark:text-red-400" /></div><div className="flex-1 min-w-0"><p className="font-semibold text-slate-900 dark:text-white truncate">{downloadName}</p><p className="text-sm text-slate-500 dark:text-slate-400">{formatFileSize(resultBlob.size)}</p></div><Button onClick={() => { const url = URL.createObjectURL(resultBlob); const a = document.createElement('a'); a.href = url; a.download = downloadName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }}><Download className="w-4 h-4 mr-2" /> Download</Button></CardContent></Card><Button variant="outline" onClick={resetAll} className="w-full"><RefreshCw className="w-4 h-4 mr-2" /> Split another PDF</Button></div>}
      </main>
      <footer className="border-t border-slate-200 dark:border-slate-800 mt-20"><div className="max-w-6xl mx-auto px-4 py-8 space-y-3"><div className="flex flex-col md:flex-row items-center justify-between gap-6"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div><span className="font-semibold text-slate-900 dark:text-white">DocSqueeze</span></div><div className="text-sm text-slate-500 dark:text-slate-400 text-center md:text-right">Privacy, terms, and contact pages are not published in this frontend yet.</div></div><p className="text-xs text-slate-400 dark:text-slate-500">API base URL: <code>{API_BASE_URL}</code>. Override with <code>NEXT_PUBLIC_DOCSQUEEZE_API_URL</code>.</p></div></footer>
    </div>
  );
}
