import { Suspense } from "react"
import { Badge } from "@/components/ui/Badge"
import { Changelog } from "@/components/changelog"
import { DownloadGrid } from "@/components/download-grid"
import { getReleaseFeed } from "@/lib/releases"

function PanelFallback() {
  return <p className="py-16 text-sm text-muted-foreground">Chargement des versions…</p>
}

async function ReleaseContent({ show }: { show: "downloads" | "journal" | "all" }) {
  const feed = await getReleaseFeed()
  const downloads = show === "downloads" || show === "all"
  const journal = show === "journal" || show === "all"

  return (
    <>
      {downloads ? (
      <section id="telecharger" className="scroll-mt-24 py-16 md:py-20">
        <div className="max-w-md space-y-6">
          <h2 className="text-balance text-4xl font-medium tracking-tight text-muted-foreground lg:text-5xl">
            <span className="text-foreground">Télécharger.</span>
            <br />
            Une version pour chaque système.
          </h2>
        </div>
        <div className="mt-4 flex items-center gap-3">
          {feed.prerelease ? <Badge variant="secondary">Préversion</Badge> : null}
          <a href={feed.releasesUrl} className="text-sm text-muted-foreground hover:text-foreground">
            {feed.version
              ? `${feed.version}${feed.dateLabel ? ` · ${feed.dateLabel}` : ""}`
              : "Voir sur GitHub"}
          </a>
        </div>
        <div className="mt-12">
          <DownloadGrid platforms={feed.platforms} />
        </div>
        {!feed.version ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Les installeurs apparaîtront ici dès qu’une version sera publiée sur GitHub.
          </p>
        ) : null}
      </section>
      ) : null}

      {journal ? (
      <section id="journal" className="scroll-mt-24 py-16 md:py-20">
        <h2 className="max-w-4xl text-balance text-4xl font-medium tracking-tight text-muted-foreground lg:text-5xl">
          <span className="text-foreground">Journal.</span> Les notes de chaque version.
        </h2>
        <div className="mt-12 max-w-2xl">
          <Changelog entries={feed.changelog} />
        </div>
      </section>
      ) : null}
    </>
  )
}

export function ReleasePanel({ show = "all" }: { show?: "downloads" | "journal" | "all" }) {
  return (
    <Suspense fallback={<PanelFallback />}>
      <ReleaseContent show={show} />
    </Suspense>
  )
}
