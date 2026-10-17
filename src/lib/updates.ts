import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { isTauri } from "@/lib/platform";

export type UpdateProgress = {
  downloaded: number;
  total: number | null;
};

export async function appVersion() {
  if (!isTauri()) {
    return null;
  }
  return getVersion();
}

export async function findUpdate() {
  if (!isTauri()) {
    return null;
  }
  return check();
}

export async function installUpdate(
  update: Update,
  onProgress?: (progress: UpdateProgress) => void,
) {
  let downloaded = 0;
  let total: number | null = null;
  await update.downloadAndInstall((event: DownloadEvent) => {
    switch (event.event) {
      case "Started":
        downloaded = 0;
        total = event.data.contentLength ?? null;
        onProgress?.({ downloaded, total });
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress?.({ downloaded, total });
        break;
      case "Finished":
        onProgress?.({ downloaded, total: total ?? downloaded });
        break;
      default: {
        const exhaustive: never = event;
        return exhaustive;
      }
    }
  });
  await relaunch();
}
