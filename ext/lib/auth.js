const AUTH_KEYS = ['appwrite_jwt', 'appwrite_user_id', 'appwrite_jwt_expires'];
const JWT_LIFETIME_MS = 15 * 60 * 1000;

export async function getAuth() {
  const data = await chrome.storage.local.get(AUTH_KEYS);
  if (!data.appwrite_jwt || !data.appwrite_user_id) return null;
  if (Date.now() > (data.appwrite_jwt_expires || 0)) return null;
  return { jwt: data.appwrite_jwt, userId: data.appwrite_user_id };
}

export async function setAuth(jwt, userId) {
  await chrome.storage.local.set({
    appwrite_jwt: jwt,
    appwrite_user_id: userId,
    appwrite_jwt_expires: Date.now() + JWT_LIFETIME_MS,
  });
}

export async function clearAuth() {
  await chrome.storage.local.remove(AUTH_KEYS);
}

export async function isLoggedIn() {
  return (await getAuth()) !== null;
}
