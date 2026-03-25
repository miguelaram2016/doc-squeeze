'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle, ChevronDown, Copy, Download, FileText, Gauge, HelpCircle, Plus, RefreshCw, Shield, Sparkles, Trash2, Upload, X, Zap } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoStrip, SurfaceCard, ToolShell } from '@/components/tool-shell';
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
  { icon: Gauge, title: 'Clear controls', description: 'Choose a compression level, upload PDFs, and get one downloadable result per file.' },
  { icon: Shield, title: 'Honest processing', description: 'Files leave the browser and are processed by the configured DocSqueeze API.' },
  { icon: Sparkles, title: 'Realistic savings', description: 'Image-heavy PDFs often shrink more than text-first or already-optimized documents.' },
];

const faqs = [
  { question: 'Is compression local?', answer: 'No. This frontend uploads files to the configured API for processing, so treat it like a normal server-backed upload flow.' },
  { question: 'Will every PDF get much smaller?', answer: 'No. Compression depends on how the original file was made. Scans and image-heavy PDFs usually see bigger savings.' },
  { question: 'Can I upload a batch?', answer: 'Yes. You can compress multiple PDFs in one run, then download each result separately.' },
  { question: 'What if something fails?', answer: 'A failed file stays labeled with an error message so you know it was not processed cleanly.' },
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
    setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  useEffect(() => {
    if (darkMode === undefined) return;
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const accepted = Array.from(fileList).filter((file) => file.type === 'application/pdf');
    const nextFiles = accepted.map((file) => ({ id: generateId(), name: file.name, size: file.size, originalSize: file.size, file }));
    const rejectedCount = fileList.length - accepted.length;

    if (nextFiles.length > 0) {
      setFiles((prev) => [...prev, ...nextFiles]);
      toast.success(`${nextFiles.length} PDF${nextFiles.length > 1 ? 's' : ''} added`);
    }
    if (rejectedCount > 0) {
      toast.error(`Skipped ${rejectedCount} non-PDF file${rejectedCount > 1 ? 's' : ''}`);
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
  const completedCount = Array.from(fileStatuses.values()).filter((status) => status === 'done').length;
  const hasErrors = results.some((result) => result.error);

  return (
    <ToolShell
      pathname={pathname}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((value) => !value)}
      totalProcessed={totalProcessed}
      isWarmingUp={isWarmingUp}
      isServiceReady={isServiceReady}
      badgeLabel="Batch PDF compression with realistic expectations"
      title="Compress PDFs without the sketchy vibes"
      subtitle="Upload one or more PDFs, choose a compression level, and download each result separately. This test frontend stays blunt about what happens: files are sent to the configured API for processing."
    >
      <Toaster />

      {appState === 'upload' && (
        <div className="space-y-10 pb-14">
          <section className="mx-auto grid max-w-5xl gap-4 px-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="rounded-3xl border-slate-200/80 bg-white/85 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
                <CardContent className="space-y-3 p-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                    <feature.icon className="h-7 w-7" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h2>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="mx-auto max-w-5xl px-4">
            <div className="grid gap-6 lg:grid-cols-[1.45fr_.95fr]">
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
                  className={`rounded-3xl border-2 border-dashed p-6 transition sm:p-8 ${
                    isDragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 bg-slate-50/60 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-950/30'
                  } cursor-pointer`}
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
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Multiple files are supported. Non-PDF files are skipped.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Ready to upload</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">You can still add more PDFs before starting compression.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}>
                          <Plus className="mr-1 h-4 w-4" /> Add files
                        </Button>
                      </div>

                      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                        {files.map((file) => {
                          const status = fileStatuses.get(file.id) ?? 'pending';
                          const progress = fileProgress.get(file.id) ?? 0;
                          const result = results.find((item) => item.originalName === file.name);
                          const ratio = result && !result.error ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0;

                          return (
                            <div key={file.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/40">
                                  <FileText className="h-5 w-5 text-red-600 dark:text-red-300" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {result && !result.error ? `${formatFileSize(result.compressedSize)} • ${ratio}% smaller` : formatFileSize(file.size)}
                                  </p>
                                  {status === 'compressing' && <Progress value={progress} className="mt-2 h-1.5" />}
                                  {result?.error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{result.error}</p>}
                                </div>
                                <div className="flex items-center gap-1">
                                  {status === 'done' && <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /></div>}
                                  {status !== 'compressing' && (
                                    <Button variant="ghost" size="icon-sm" onClick={(event) => { event.stopPropagation(); setFiles((prev) => prev.filter((item) => item.id !== file.id)); }}>
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button variant="outline" className="justify-start" onClick={() => toast.info('Google Drive import is not built in this frontend yet.')}>Google Drive (soon)</Button>
                    <Button variant="outline" className="justify-start" onClick={() => toast.info('Dropbox import is not built in this frontend yet.')}>Dropbox (soon)</Button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Those cloud import buttons are intentionally labeled as placeholders, not broken actions.</p>
                </div>
              </SurfaceCard>

              <div className="space-y-6">
                <SurfaceCard className="p-5 sm:p-6">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Compression settings</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{files.length} file{files.length === 1 ? '' : 's'} selected</p>
                    </div>
                    {files.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetAll}>
                        <Trash2 className="mr-1 h-4 w-4" /> Clear all
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Compression level</Label>
                      <Select value={compressionLevel} onValueChange={(value) => setCompressionLevel(value as CompressionLevel)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ultra">Ultra — maximum compression</SelectItem>
                          <SelectItem value="high">High — aggressive</SelectItem>
                          <SelectItem value="medium">Medium — balanced</SelectItem>
                          <SelectItem value="low">Low — higher visual quality</SelectItem>
                          <SelectItem value="minimal">Minimal — smallest change</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-slate-500 dark:text-slate-400">More compression usually means smaller files with more visible quality trade-offs.</p>
                    </div>

                    <InfoStrip>
                      Start with <span className="font-medium text-slate-800 dark:text-white">Medium</span> unless you are testing for the smallest possible file size.
                    </InfoStrip>

                    <Button
                      onClick={handleCompress}
                      disabled={files.length === 0 || !isServiceReady || isWarmingUp}
                      className="h-12 w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-base hover:from-violet-700 hover:to-indigo-700"
                    >
                      <Zap className="mr-2 h-5 w-5" />
                      {files.length === 0 ? 'Add PDFs to continue' : files.length === 1 ? 'Compress PDF' : `Compress ${files.length} PDFs`}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>

                    {!isWarmingUp && !isServiceReady && (
                      <p className="text-sm text-rose-600 dark:text-rose-300">The API is not reachable right now, so uploads are disabled until it comes back.</p>
                    )}
                  </div>
                </SurfaceCard>

                <SurfaceCard className="p-5 sm:p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">What to expect</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    <li>• Upload progress mostly reflects the trip to the API, not the full server-side work.</li>
                    <li>• Each file is returned separately, so one bad file does not need to make the whole run feel mysterious.</li>
                    <li>• If the backend fails, this frontend should say so plainly instead of pretending everything happened locally.</li>
                  </ul>
                </SurfaceCard>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-3xl px-4 pt-2">
            <h3 className="mb-5 text-center text-2xl font-semibold text-slate-900 dark:text-white">FAQs</h3>
            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <Card key={faq.question} className="rounded-2xl border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/80">
                  <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                    <span className="flex items-center gap-3 font-medium text-slate-900 dark:text-white"><HelpCircle className="h-5 w-5 text-violet-600 dark:text-violet-300" />{faq.question}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === index && <div className="px-4 pb-4 pl-12 text-sm leading-6 text-slate-600 dark:text-slate-300">{faq.answer}</div>}
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}

      {appState === 'processing' && (
        <div className="mx-auto max-w-2xl px-4 py-20">
          <SurfaceCard className="p-8 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/40">
              <Zap className="h-10 w-10 animate-pulse text-violet-600 dark:text-violet-300" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-white">Compressing your PDFs</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Your files are on the way to the API and being processed there. Bigger or image-heavy PDFs can take noticeably longer.</p>
            <Progress value={totalProgress} className="mt-6 h-3" />
            <div className="mt-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>{completedCount} of {files.length} marked complete</span>
              <span className="font-medium text-violet-600 dark:text-violet-300">{totalProgress}%</span>
            </div>
          </SurfaceCard>
        </div>
      )}

      {appState === 'result' && results.length > 0 && (
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-14">
          <SurfaceCard className="p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
              <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-300" />
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">Compression finished</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {totalSavings > 0 ? `Total saved: ${formatFileSize(totalSavings)}.` : 'Your files are ready.'} Download each result individually below.
            </p>
            {hasErrors && <p className="mt-2 text-sm text-amber-600 dark:text-amber-300">Some files returned errors. They are labeled clearly so you can retest them separately.</p>}
          </SurfaceCard>

          <div className="space-y-3">
            {results.map((result) => {
              const ratio = result.originalSize > 0 ? Math.round((1 - result.compressedSize / result.originalSize) * 100) : 0;
              return (
                <Card key={result.originalName} className="rounded-2xl border-slate-200/80 bg-white/95 dark:border-slate-800 dark:bg-slate-900/85">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/40">
                        <FileText className="h-5 w-5 text-red-600 dark:text-red-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{result.originalName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {result.error ? result.error : `${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} • ${ratio}% smaller`}
                        </p>
                      </div>
                    </div>

                    {!result.error && result.compressedBlob && (
                      <div className="flex items-center gap-2 sm:ml-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(result.originalName.replace(/\.pdf$/i, '_compressed.pdf'));
                            setCopiedId(result.originalName);
                            setTimeout(() => setCopiedId(null), 1500);
                          }}
                          aria-label="Copy suggested filename"
                        >
                          {copiedId === result.originalName ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" onClick={() => handleDownload(result)}>
                          <Download className="mr-1 h-3.5 w-3.5" /> Download
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Button variant="outline" onClick={resetAll} className="h-11 w-full">
            <RefreshCw className="mr-2 h-4 w-4" /> Compress more files
          </Button>
        </div>
      )}
    </ToolShell>
  );
}
