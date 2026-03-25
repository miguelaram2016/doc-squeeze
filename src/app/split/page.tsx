'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, Download, FileText, Loader2, RefreshCw, Scissors, Sparkles, Upload, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { InfoStrip, SurfaceCard, ToolShell } from '@/components/tool-shell';
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
    setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  useEffect(() => {
    if (darkMode === undefined) return;
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const addFile = useCallback((fileList: FileList | null) => {
    if (!fileList?.length) return;
    const file = fileList[0];
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported here');
      return;
    }
    setSelectedFile(file);
    toast.success('PDF selected');
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
    <ToolShell
      pathname={pathname}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((value) => !value)}
      totalProcessed={totalProcessed}
      isWarmingUp={isWarmingUp}
      isServiceReady={isServiceReady}
      badgeLabel="Split one PDF into pages or a custom selection"
      title="Split PDFs without ambiguous output"
      subtitle="Choose one PDF, decide whether you want every page or a custom range, and get the backend result with a filename that tries to match the actual output."
    >
      <Toaster />

      {appState === 'upload' && (
        <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-14 lg:grid-cols-[1.3fr_1fr]">
          <SurfaceCard className="p-5 sm:p-6">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFile(event.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-3xl border-2 border-dashed p-6 transition sm:p-8 ${
                isDragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 bg-slate-50/60 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-950/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => {
                  addFile(event.target.files);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="hidden"
              />

              {!selectedFile ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                    <Upload className="h-8 w-8" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">Drop one PDF here or click to browse</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Only one file is used on this page so the split result stays predictable.</p>
                </div>
              ) : (
                <Card className="rounded-2xl border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/80">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/40">
                      <FileText className="h-5 w-5 text-red-600 dark:text-red-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => setSelectedFile(null)}><X className="h-3.5 w-3.5" /></Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </SurfaceCard>

          <div className="space-y-6">
            <SurfaceCard className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Split settings</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose the output you want before sending the file to the API.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <button onClick={() => setSplitMode('all')} className={`rounded-2xl border p-4 text-left transition ${splitMode === 'all' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70'}`}>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white"><Scissors className="h-4 w-4 text-violet-600 dark:text-violet-300" /> All pages</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Usually returns a ZIP containing one-page PDFs.</p>
                </button>
                <button onClick={() => setSplitMode('custom')} className={`rounded-2xl border p-4 text-left transition ${splitMode === 'custom' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70'}`}>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white"><Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" /> Custom range</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Usually returns one PDF containing only the pages you kept.</p>
                </button>
              </div>

              {splitMode === 'custom' && (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="pageRange">Page ranges</Label>
                  <input
                    id="pageRange"
                    value={pageRange}
                    onChange={(event) => setPageRange(event.target.value)}
                    placeholder="e.g. 1-3, 4, 5-7"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-violet-900"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Use commas between single pages or ranges.</p>
                </div>
              )}

              <div className="mt-4 space-y-4">
                <InfoStrip>
                  This page labels expected output honestly because backend responses may differ: all pages usually means ZIP, custom range usually means one PDF.
                </InfoStrip>
                <Button onClick={handleSplit} disabled={!selectedFile || !isServiceReady || isWarmingUp} className="h-12 w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-base hover:from-violet-700 hover:to-indigo-700">
                  <Scissors className="mr-2 h-5 w-5" /> Split PDF
                </Button>
                {!isWarmingUp && !isServiceReady && <p className="text-sm text-rose-600 dark:text-rose-300">The split API is not reachable right now.</p>}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Quick notes</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <li>• Keep the page range syntax simple: <span className="font-medium text-slate-800 dark:text-white">1-3, 5, 8-10</span>.</li>
                <li>• Splitting happens on the API, not fully in the browser.</li>
                <li>• If you want to keep only a few pages together, choose custom range.</li>
              </ul>
            </SurfaceCard>
          </div>
        </div>
      )}

      {appState === 'processing' && (
        <div className="mx-auto max-w-2xl px-4 py-20">
          <SurfaceCard className="p-8 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/40">
              <Loader2 className="h-10 w-10 animate-spin text-violet-600 dark:text-violet-300" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-white">Splitting your PDF</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">The file is being sent to the configured API and processed there. ZIP outputs can take longer because multiple files may be generated server-side.</p>
            <Progress value={processingProgress} className="mt-6 h-3" />
          </SurfaceCard>
        </div>
      )}

      {appState === 'result' && resultBlob && (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-14">
          <SurfaceCard className="p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
              <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-300" />
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">Split result ready</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Download the file returned by the API below.</p>
          </SurfaceCard>

          <Card className="rounded-2xl border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/85">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/40">
                  <FileText className="h-6 w-6 text-red-600 dark:text-red-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-white">{downloadName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{formatFileSize(resultBlob.size)}</p>
                </div>
              </div>
              <Button onClick={() => { const url = URL.createObjectURL(resultBlob); const a = document.createElement('a'); a.href = url; a.download = downloadName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={resetAll} className="h-11 w-full"><RefreshCw className="mr-2 h-4 w-4" /> Split another PDF</Button>
        </div>
      )}
    </ToolShell>
  );
}
