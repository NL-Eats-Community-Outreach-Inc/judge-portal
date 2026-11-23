'use client';

import { useEffect, useState, useRef } from 'react';
import { Download, FileText, LoaderCircle, AlertCircle } from 'lucide-react';

type FileBlockViewerProps = {
  fileUrl: string;
  title: string;
  description?: string;
  originalFilename?: string;
  mimeType?: string;
};

type PreviewKind = 'text' | 'docx' | 'pdf' | 'download';

function getPreviewKind(filename: string, mimeType?: string): PreviewKind {
  const extension = filename.split('.').pop()?.toLowerCase();
  const normalizedMimeType = mimeType?.toLowerCase().split(';')[0].trim();

  if (extension === 'txt' || normalizedMimeType === 'text/plain') return 'text';
  if (
    extension === 'docx' ||
    normalizedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  if (extension === 'pdf' || normalizedMimeType === 'application/pdf') return 'pdf';

  // Legacy .doc files and other formats remain downloadable, but are not
  // passed through an unreliable or unsafe in-browser conversion.
  return 'download';
}

export default function FileBlockViewer({
  fileUrl,
  title,
  description,
  originalFilename,
  mimeType,
}: FileBlockViewerProps) {
  const filename = originalFilename || title;
  const previewKind = getPreviewKind(filename, mimeType);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(previewKind === 'text' || previewKind === 'docx');
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (previewKind !== 'text' && previewKind !== 'docx') return;

    const docxContainer = docxContainerRef.current;

    const controller = new AbortController();
    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setPreviewError(null);
      setTextContent(null);

      try {
        const previewUrl = `/api/learner/file-preview?url=${encodeURIComponent(fileUrl)}`;
        const response = await fetch(previewUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`The file could not be loaded (${response.status}).`);
        }

        if (previewKind === 'text') {
          const content = await response.text();
          if (!cancelled) setTextContent(content);
          return;
        }

        const documentData = await response.arrayBuffer();
        if (cancelled || !docxContainer) return;

        const { renderAsync } = await import('docx-preview');
        if (cancelled || !docxContainer) return;

        docxContainer.replaceChildren();
        await renderAsync(documentData, docxContainer, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: true,
          ignoreHeight: true,
          breakPages: false,
          renderAltChunks: false,
        });
      } catch (error) {
        if (cancelled || (error instanceof Error && error.name === 'AbortError')) return;
        setPreviewError(
          error instanceof Error ? error.message : 'The document preview could not be loaded.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
      controller.abort();
      docxContainer?.replaceChildren();
    };
  }, [fileUrl, previewKind]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="break-words font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            {originalFilename && originalFilename !== title && (
              <p className="mt-1 break-all text-xs text-muted-foreground">{originalFilename}</p>
            )}
          </div>
        </div>

        <a
          href={fileUrl}
          download={originalFilename || title}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>

      {previewKind === 'pdf' && (
        <div className="bg-muted/30 p-2 sm:p-4">
          <iframe
            src={fileUrl}
            title={`Preview: ${title}`}
            className="h-[min(80vh,900px)] w-full rounded-lg border border-border bg-white"
          />
        </div>
      )}

      {(previewKind === 'text' || previewKind === 'docx') && (
        <div className="p-3 sm:p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Preparing document preview…
            </div>
          )}

          {previewError && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>{previewError} You can still download the original file above.</span>
            </div>
          )}

          {previewKind === 'text' && textContent !== null && !loading && (
            <pre className="max-h-[min(75vh,800px)] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-4 font-mono text-sm leading-relaxed">
              {textContent}
            </pre>
          )}

          {previewKind === 'docx' && (
            <div
              ref={docxContainerRef}
              className="docx-preview-container max-h-[min(80vh,900px)] overflow-auto rounded-lg bg-muted/30 p-2 sm:p-4"
            />
          )}
        </div>
      )}

      {previewKind === 'download' && (
        <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <FileText className="h-5 w-5 shrink-0" />
          <p>
            This file type can&apos;t be previewed here. Download it to open it with a compatible
            app.
          </p>
        </div>
      )}
    </section>
  );
}
