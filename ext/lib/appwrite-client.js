import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from './config.js';
import { clearAuth } from './auth.js';

async function request(method, path, jwt, body) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': APPWRITE_PROJECT_ID,
    'X-Appwrite-JWT': jwt,
  };

  const res = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    method,
    headers,
    credentials: 'omit',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    await clearAuth();
    throw new Error('AUTH_EXPIRED');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Appwrite ${res.status}: ${text}`);
  }

  return res.json();
}

export async function listDocuments(jwt, databaseId, collectionId, queries = []) {
  const params = new URLSearchParams();
  for (const q of queries) {
    params.append('queries[]', q);
  }
  const qs = params.toString();
  const path = `/databases/${databaseId}/collections/${collectionId}/documents${qs ? '?' + qs : ''}`;
  return request('GET', path, jwt);
}

export async function createDocument(jwt, databaseId, collectionId, data, documentId = 'unique()') {
  const path = `/databases/${databaseId}/collections/${collectionId}/documents`;
  return request('POST', path, jwt, { documentId, data });
}

export async function deleteDocument(jwt, databaseId, collectionId, documentId) {
  const path = `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`;
  return request('DELETE', path, jwt);
}

export async function updateDocument(jwt, databaseId, collectionId, documentId, data) {
  const path = `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`;
  return request('PATCH', path, jwt, { data });
}
