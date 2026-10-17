import type { Metadata } from "next";
import { ReleasePanel } from "@/components/release-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Télécharger — Scribbly",
  description:
    "Installez Scribbly sur macOS, Windows, Debian ou Fedora. Les notes restent des fichiers Markdown sur la machine.",
};

export default function DownloadPage() {
  return (
    <div>
      <SiteHeader />
      <main>
        <div className="mx-auto max-w-7xl px-6">
          <ReleasePanel show="downloads" />
        </div>

        <div className="mx-auto max-w-7xl px-6">
          <ReleasePanel show="journal" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
