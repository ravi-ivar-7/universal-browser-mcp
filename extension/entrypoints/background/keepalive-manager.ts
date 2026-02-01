/**
 * @fileoverview Keepalive Manager (Stubbed)
 * @description Fixes build after Record-Replay removal.
 */

export function acquireKeepalive(tag: string): () => void {
  console.debug(`[KeepaliveManager] Stub acquired for: ${tag}`);
  return () => {
    console.debug(`[KeepaliveManager] Stub released for: ${tag}`);
  };
}

export function isKeepaliveActive(): boolean {
  return false;
}

export function getKeepaliveRefCount(): number {
  return 0;
}
