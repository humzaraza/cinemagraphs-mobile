// Banner photo upload from React Native (PR 1b mobile prompt 3).
//
// The web side at /api/user/banner/upload uses @vercel/blob/client's
// handleUpload, which is a two-step client-direct-to-blob protocol:
//
//   Step A: POST our handleUpload route with a generate-client-token
//           event. Server validates pathname namespace + content type
//           cap and returns a short-lived clientToken.
//   Step B: PUT the file bytes directly to Vercel Blob's API using the
//           clientToken as Authorization. Server adds a random suffix
//           and returns the FINAL pathname + CDN url.
//
// The @vercel/blob client SDK is browser-targeted (uses location.href,
// undici-style fetch options, ReadableStream duplex semantics) and does
// not work in React Native, so this module replays the wire protocol
// using plain fetch. The protocol details (request/response shapes,
// header names, blob API URL) are mirrored from the SDK source we
// inspected during inventory:
//
//   - Step A: { type: 'blob.generate-client-token', payload:
//     { pathname, clientPayload, multipart } } -> { clientToken }
//   - Step B: PUT https://vercel.com/api/blob/?pathname=<enc> with
//     headers x-vercel-blob-access=public, x-content-type=<mime>,
//     x-api-version=12, authorization=Bearer <clientToken>.
//
// The server-side onBeforeGenerateToken bakes addRandomSuffix=true into
// the clientToken, so the FINAL pathname returned in step B's response
// is what gets PATCHed as bannerValue (NOT the pathname we sent in step
// A).
//
// Single-shot PUT, no retries: a non-2xx surfaces as a thrown Error and
// the picker shows an Alert. The user retries by tapping Save again.

import { apiFetch } from './api';

const VERCEL_BLOB_API_URL = 'https://vercel.com/api/blob';
const VERCEL_BLOB_API_VERSION = '12';
const HANDLE_UPLOAD_PATH = '/user/banner/upload';

export interface UploadBannerPhotoResult {
  // The final pathname after the server appends a random suffix. Persist
  // this as bannerValue via PATCH /api/user/banner.
  pathname: string;
  // The full CDN URL returned by Vercel Blob. Useful for immediate
  // display in the picker preview without waiting for a Profile refetch.
  url: string;
}

export interface UploadBannerPhotoArgs {
  // Local file URI from expo-image-manipulator (file://...).
  fileUri: string;
  // Authenticated user id; used to namespace the pathname under
  // banners/<userId>/. The server enforces this prefix.
  userId: string;
  // Defaults to 'image/jpeg' since we always crop to JPEG before upload.
  // Server only accepts image/jpeg or image/png.
  contentType?: 'image/jpeg' | 'image/png';
  // Optional cancellation. Forwarded to both fetch calls.
  signal?: AbortSignal;
}

export async function uploadBannerPhoto(
  args: UploadBannerPhotoArgs,
): Promise<UploadBannerPhotoResult> {
  const { fileUri, userId, contentType = 'image/jpeg', signal } = args;

  if (!fileUri) throw new Error('uploadBannerPhoto: fileUri is required');
  if (!userId) throw new Error('uploadBannerPhoto: userId is required');

  // Build a deterministic pathname under the user's namespace. Server
  // appends a random suffix before .jpg (addRandomSuffix=true), so two
  // uploads in the same millisecond still produce distinct blobs.
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const requestedPathname = `banners/${userId}/${Date.now()}.${ext}`;

  // Step A: ask our handleUpload route for a clientToken. apiFetch
  // attaches the user's JWT Bearer header automatically.
  const tokenRes = await apiFetch(HANDLE_UPLOAD_PATH, {
    method: 'POST',
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: {
        pathname: requestedPathname,
        clientPayload: null,
        multipart: false,
      },
    }),
    signal,
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(err.error || `Banner upload token request failed (${tokenRes.status})`);
  }
  const tokenJson = (await tokenRes.json()) as { clientToken?: string };
  const clientToken = tokenJson.clientToken;
  if (!clientToken) {
    throw new Error('Banner upload token response missing clientToken');
  }

  // Step B: read the cropped file as a Blob and PUT it to Vercel Blob.
  // RN's fetch() supports file:// URIs; the resulting Response can be
  // turned into a Blob whose bytes back the upload body.
  const fileRes = await fetch(fileUri);
  if (!fileRes.ok) {
    throw new Error(`Failed to read cropped photo from disk (${fileRes.status})`);
  }
  const fileBlob = await fileRes.blob();

  const params = new URLSearchParams({ pathname: requestedPathname });
  const blobUrl = `${VERCEL_BLOB_API_URL}/?${params.toString()}`;
  const requestId = `${userId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;

  const putRes = await fetch(blobUrl, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${clientToken}`,
      'x-vercel-blob-access': 'public',
      'x-content-type': contentType,
      'x-api-version': VERCEL_BLOB_API_VERSION,
      'x-api-blob-request-id': requestId,
      'x-api-blob-request-attempt': '0',
    },
    body: fileBlob,
    signal,
  });

  if (!putRes.ok) {
    let detail = '';
    try {
      const errBody = await putRes.json();
      detail = errBody?.error?.message || errBody?.message || '';
    } catch {
      // Non-JSON error body; ignore.
    }
    throw new Error(
      `Vercel Blob upload failed (${putRes.status})${detail ? `: ${detail}` : ''}`,
    );
  }

  const blobResult = (await putRes.json()) as {
    url?: string;
    pathname?: string;
  };
  if (!blobResult.url || !blobResult.pathname) {
    throw new Error('Vercel Blob upload response missing url or pathname');
  }
  return { pathname: blobResult.pathname, url: blobResult.url };
}
