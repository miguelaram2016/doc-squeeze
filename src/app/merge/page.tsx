'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle, Download, FileText, Files, Loader2, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { InfoStrip, SurfaceCard, ToolShell } from '@/components/tool-shell';
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
    setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  useEffect(() => {
    if (darkMode === undefined) return;
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const accepted = Array.from(fileList).filter((file) => file.type === 'application/pdf');
    const nextFiles = accepted.map((file) => ({ id: generateId(), name: file.name, size: file.size, file }));
    const rejectedCount = fileList.length - accepted.length;
    if (nextFiles.length > 0) {
      setFiles((prev) => [...prev, ...nextFiles]);
      toast.success(`${nextFiles.length} PDF${nextFiles.length > 1 ? 's' : ''} added`);
    }
    if (rejectedCount > 0) {
      toast.error(`Skipped ${rejectedCount} non-PDF file${rejectedCount > 1 ? 's' : ''}`);
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
    <ToolShell
      pathname={pathname}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((value) => !value)}
      totalProcessed={totalProcessed}
      isWarmingUp={isWarmingUp}
      isServiceReady={isServiceReady}
      badgeLabel="Merge PDFs in the order you see"
      title="Merge PDFs with fewer rough edges"
      subtitle="Add at least two PDFs, reorder them, and download one merged file when the API finishes. This page keeps the order and backend dependency obvious instead of hiding it."
    >
      <Toaster />

      {appState === 'upload' && (
        <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-14 lg:grid-cols-[1.4fr_1fr]">
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
                addFiles(event.dataTransfer.files);
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
                multiple
                onChange={(event) => {
                  addFiles(event.target.files);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="hidden"
              />

              {files.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                    <Upload className="h-8 w-8" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">Drop PDFs here or click to browse</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">You need at least two PDFs before merge becomes available.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Merge order</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Top to bottom becomes page order in the merged output.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}>
                      <Plus className="mr-1 h-4 w-4" /> Add files
                    </Button>
                  </div>

                  <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                    {files.map((file, index) => (
                      <Card key={file.id} className="rounded-2xl border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/80">
                        <CardContent className="flex items-center gap-3 p-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-sm font-semibold text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">{index + 1}</div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/40">
                            <FileText className="h-5 w-5 text-red-600 dark:text-red-300" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => setFiles((prev) => { const next = [...prev]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon-sm" disabled={index === files.length - 1} onClick={() => setFiles((prev) => { const next = [...prev]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}><ArrowDown className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setFiles((prev) => prev.filter((item) => item.id !== file.id))}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SurfaceCard>

          <div className="space-y-6">
            <SurfaceCard className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Merge settings</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{files.length} file{files.length === 1 ? '' : 's'} selected</p>
                </div>
                {files.length > 0 && <Button variant="ghost" size="sm" onClick={resetAll}><Trash2 className="mr-1 h-4 w-4" /> Clear all</Button>}
              </div>

              <div className="mt-4 space-y-4">
                <InfoStrip>
                  If the backend sends a filename, the download button will use it. Otherwise the fallback stays <span className="font-medium text-slate-800 dark:text-white">merged_document.pdf</span>.
                </InfoStrip>
                <InfoStrip>
                  Merge is disabled until the API is reachable and you have at least two PDFs.
                </InfoStrip>
                <Button onClick={handleMerge} disabled={files.length < 2 || !isServiceReady || isWarmingUp} className="h-12 w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-base hover:from-violet-700 hover:to-indigo-700">
                  <Files className="mr-2 h-5 w-5" />
                  {files.length < 2 ? 'Add at least 2 PDFs' : `Merge ${files.length} PDFs`}
                </Button>
                {!isWarmingUp && !isServiceReady && <p className="text-sm text-rose-600 dark:text-rose-300">The merge API is not reachable right now.</p>}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Before you test</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <li>• Reorder buttons are the source of truth for output order.</li>
                <li>• The merge itself happens on the API, so upload time and server time are both part of the wait.</li>
                <li>• This page is intentionally light on fake "AI" language. It just merges PDFs.</li>
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
            <h2 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-white">Merging your PDFs</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">The upload and merge are happening against the configured API. Large files or lots of pages can take a minute.</p>
            <Progress value={processingProgress} className="mt-6 h-3" />
          </SurfaceCard>
        </div>
      )}

      {appState === 'result' && mergedBlob && (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-14">
          <SurfaceCard className="p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
              <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-300" />
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">Merged file ready</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">One merged PDF came back from the API. Download it below.</p>
          </SurfaceCard>

          <Card className="rounded-2xl border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/85">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/40">
                  <FileText className="h-6 w-6 text-red-600 dark:text-red-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-white">{downloadName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{formatFileSize(mergedBlob.size)}</p>
                </div>
              </div>
              <Button onClick={() => { const url = URL.createObjectURL(mergedBlob); const a = document.createElement('a'); a.href = url; a.download = downloadName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={resetAll} className="h-11 w-full"><RefreshCw className="mr-2 h-4 w-4" /> Merge more files</Button>
        </div>
      )}
    </ToolShell>
  );
}
