const onlineUsers = new Map<string, number>();
const EXPIRY_MS = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [id, ts] of onlineUsers) {
    if (now - ts > EXPIRY_MS) onlineUsers.delete(id);
  }
}

export function recordHeartbeat(userId: string) {
  onlineUsers.set(userId, Date.now());
  cleanup();
}

export function getOnlineCount(): number {
  cleanup();
  return onlineUsers.size;
}
