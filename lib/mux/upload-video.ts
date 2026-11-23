type CreateUploadResponse = {
  uploadId: string;
  uploadUrl: string;
  status: string;
};

type UploadVideoOptions = {
  file: File;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

type UploadVideoResult = {
  uploadId: string;
};

export async function uploadVideo({
  file,
  onProgress,
  signal,
}: UploadVideoOptions): Promise<UploadVideoResult> {
  // 1. Request a direct upload URL from our backend.
  const response = await fetch('/api/teacher/mux/uploads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: file.name }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Failed to create Mux upload');
  }

  const upload: CreateUploadResponse = await response.json();

  if (!upload.uploadId || !upload.uploadUrl) {
    throw new Error('Mux returned an invalid upload response');
  }

  // 2. Upload the file directly to Mux.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', upload.uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);

        onProgress?.(progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Mux upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error while uploading video to Mux'));
    };

    xhr.onabort = () => {
      reject(new Error('Video upload was cancelled'));
    };

    if (signal) {
      if (signal.aborted) {
        reject(new Error('Video upload was cancelled'));
        return;
      }

      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });

  // 3. Return the upload ID so we can track processing.
  return {
    uploadId: upload.uploadId,
  };
}
