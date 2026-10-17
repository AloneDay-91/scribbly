import { cacheLife, cacheTag } from "next/cache"

const REPO = process.env.GITHUB_REPOSITORY ?? "AloneDay-91/scribbly"

export type PlatformId = "macos" | "debian" | "fedora" | "windows"

export type DownloadFile = {
  name: string
  url: string
  label: string
  sizeLabel: string
}

export type PlatformOffer = {
  id: PlatformId
  name: string
  detail: string
  files: DownloadFile[]
}

export type ChangelogEntry = {
  id: number
  tag: string
  title: string
  body: string
  dateLabel: string
  url: string
  prerelease: boolean
}

export type ReleaseFeed = {
  repo: string
  releasesUrl: string
  version: string | null
  dateLabel: string | null
  prerelease: boolean
  platforms: PlatformOffer[]
  changelog: ChangelogEntry[]
}

type GhAsset = {
  name: string
  browser_download_url: string
  size: number
}

type GhRelease = {
  id: number
  tag_name: string
  name: string | null
  body: string | null
  draft: boolean
  prerelease: boolean
  published_at: string | null
  html_url: string
  assets: GhAsset[]
}

const PLATFORMS: { id: PlatformId; name: string; detail: string }[] = [
  { id: "macos", name: "macOS", detail: "Disque .dmg, Apple Silicon et Intel" },
  { id: "debian", name: "Debian", detail: "Paquet .deb, Debian et Ubuntu" },
  { id: "fedora", name: "Fedora", detail: "Paquet .rpm" },
  { id: "windows", name: "Windows", detail: "Installateur" },
]

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
})

function formatDate(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return dateFormat.format(date)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  })} Mo`
}

function platformOf(name: string): PlatformId | null {
  const lower = name.toLowerCase()
  if (lower.endsWith(".sig") || lower.endsWith(".json") || lower.includes(".tar.")) {
    return null
  }
  if (lower.endsWith(".dmg")) return "macos"
  if (lower.endsWith(".deb")) return "debian"
  if (lower.endsWith(".rpm")) return "fedora"
  if (lower.endsWith(".msi") || lower.endsWith(".exe")) return "windows"
  return null
}

function fileLabel(id: PlatformId, name: string): string {
  const lower = name.toLowerCase()
  switch (id) {
    case "macos":
      if (lower.includes("aarch64") || lower.includes("arm64")) return "Apple Silicon"
      if (lower.includes("x86_64") || lower.includes("x64")) return "Intel"
      return "macOS"
    case "debian":
      return lower.includes("aarch64") || lower.includes("arm64") ? "ARM64" : "amd64"
    case "fedora":
      return lower.includes("aarch64") ? "aarch64" : "x86_64"
    case "windows":
      return lower.endsWith(".msi") ? "MSI" : "Installateur"
    default: {
      const unreachable: never = id
      return unreachable
    }
  }
}

function fileRank(id: PlatformId, name: string): number {
  const lower = name.toLowerCase()
  switch (id) {
    case "macos":
      return lower.includes("aarch64") || lower.includes("arm64") ? 0 : 1
    case "windows":
      return lower.endsWith(".exe") ? 0 : 1
    case "debian":
    case "fedora":
      return 0
    default: {
      const unreachable: never = id
      return unreachable
    }
  }
}

function filesFor(release: GhRelease, id: PlatformId): DownloadFile[] {
  return release.assets
    .filter((asset) => platformOf(asset.name) === id)
    .sort((a, b) => fileRank(id, a.name) - fileRank(id, b.name))
    .map((asset) => ({
      name: asset.name,
      url: asset.browser_download_url,
      label: fileLabel(id, asset.name),
      sizeLabel: formatSize(asset.size),
    }))
}

function emptyFeed(): ReleaseFeed {
  return {
    repo: REPO,
    releasesUrl: `https://github.com/${REPO}/releases`,
    version: null,
    dateLabel: null,
    prerelease: false,
    platforms: PLATFORMS.map((platform) => ({ ...platform, files: [] })),
    changelog: [],
  }
}

export async function getReleaseFeed(): Promise<ReleaseFeed> {
  "use cache"
  cacheLife({ stale: 60, revalidate: 60, expire: 300 })
  cacheTag("github-releases")

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "scribbly-site",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  let response: Response
  try {
    response = await fetch(
      `https://api.github.com/repos/${REPO}/releases?per_page=20`,
      { headers },
    )
  } catch {
    return emptyFeed()
  }

  if (!response.ok) return emptyFeed()

  const payload: unknown = await response.json()
  if (!Array.isArray(payload)) return emptyFeed()

  const releases = payload.filter(isRelease).filter((release) => !release.draft)
  const latest = releases.find((release) => !release.prerelease) ?? releases[0]
  const feed = emptyFeed()

  if (latest) {
    feed.version = latest.tag_name
    feed.dateLabel = formatDate(latest.published_at)
    feed.prerelease = latest.prerelease
    feed.platforms = PLATFORMS.map((platform) => ({
      ...platform,
      files: filesFor(latest, platform.id),
    }))
  }

  feed.changelog = releases.map((release) => ({
    id: release.id,
    tag: release.tag_name,
    title: release.name?.trim() || release.tag_name,
    body: release.body?.trim() ?? "",
    dateLabel: formatDate(release.published_at),
    url: release.html_url,
    prerelease: release.prerelease,
  }))

  return feed
}

function isRelease(value: unknown): value is GhRelease {
  if (!value || typeof value !== "object") return false
  const release = value as Partial<GhRelease>
  return (
    typeof release.id === "number" &&
    typeof release.tag_name === "string" &&
    typeof release.html_url === "string" &&
    Array.isArray(release.assets)
  )
}
