const DEFAULT_API_BASE_URL = 'https://doc-squeeze-api.onrender.com';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_DOCSQUEEZE_API_URL?.trim() || DEFAULT_API_BASE_URL;

export function getDownloadFilenameFromHeaders(
  headers: Headers,
  fallback: string
): string {
  const contentDisposition = headers.get('content-disposition');
  const match = contentDisposition?.match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i);

  if (!match?.[1]) {
    return fallback;
  }

  try {
    return decodeURIComponent(match[1].replace(/\"/g, '').trim());
  } catch {
    return match[1].replace(/\"/g, '').trim();
  }
}
