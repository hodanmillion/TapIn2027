const BUILD =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  process.env.NEXT_PUBLIC_BUILD_ID ||
  "dev";

const KEY = "tapin:build";

export function clearOldCacheIfBuildChanged() {
  if (typeof window === "undefined") return;

  const prev = localStorage.getItem(KEY);

  if (!prev) {
    localStorage.setItem(KEY, BUILD);
    return;
  }

  if (prev !== BUILD) {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      if (
        k.startsWith("tapin:") ||
        k.includes("cached_location") ||
        k.includes("cached_chats") ||
        k.includes("history")
      ) {
        toDelete.push(k);
      }
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(KEY, BUILD);

    window.location.reload();
  }
}
