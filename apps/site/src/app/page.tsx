import Image from "next/image";
import {
  Bell,
  FileText,
  Folder,
  HardDrive,
  Link2,
  Type,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroPreview } from "@/components/hero-preview";
import { ReleasePanel } from "@/components/release-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const features = [
  {
    id: "fichiers",
    label: "Fichiers",
    lead: "Chaque note est un Markdown.",
    rest: "La première ligne est le titre, le reste est la page.",
    items: [
      { icon: FileText, label: "Lisible en dehors de l’app" },
      { icon: Folder, label: "Un dossier par chapitre" },
      { icon: Link2, label: "Des liens en chemins relatifs" },
    ],
  },
  {
    id: "editeur",
    label: "Éditeur",
    lead: "Blocs, titres, listes et images.",
    rest: "La commande / insère, la poignée déplace une section.",
    items: [
      { icon: Type, label: "Commande / pour les blocs" },
      { icon: FileText, label: "Tableaux et listes" },
      { icon: Folder, label: "Images à côté des notes" },
    ],
  },
  {
    id: "chapitres",
    label: "Chapitres",
    lead: "L’ordre se pose à la main.",
    rest: "Les dossiers rangent les pages, et la corbeille reste sur la machine.",
    items: [
      { icon: Folder, label: "Un dossier par chapitre" },
      { icon: Link2, label: "Plusieurs wikis" },
      { icon: FileText, label: "Corbeille locale" },
    ],
  },
  {
    id: "machine",
    label: "Machine",
    lead: "Rien ne quitte l’ordinateur.",
    rest: "Pas de compte pour écrire, pas de serveur pour stocker.",
    items: [
      { icon: HardDrive, label: "macOS, Windows, Debian, Fedora" },
      { icon: Zap, label: "Ouvert sans connexion" },
      { icon: Bell, label: "La version web arrive plus tard" },
    ],
  },
];

export default function Home() {
  return (
    <div id="haut">
      <SiteHeader />
      <main>
        <section className="pt-40 xl:pt-48">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid items-end gap-4 md:grid-cols-2 md:gap-6">
              <h1 className="text-balance text-4xl font-medium tracking-tight md:text-5xl">
                Vos notes restent des fichiers.
              </h1>
              <div className="flex max-w-md flex-col gap-4 md:mx-auto">
                <p className="text-balance text-lg text-muted-foreground">
                  Chapitres, éditeur, espaces de travail.
                </p>
                <Button
                  className="h-9 w-fit rounded-full px-4 text-sm"
                  render={<a href="/download" />}
                >
                  Télécharger
                </Button>
              </div>
            </div>
            <HeroPreview />
          </div>
        </section>

        <section id="produit" className="scroll-mt-24 py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="max-w-4xl text-balance text-4xl font-medium tracking-tight text-muted-foreground">
              <span className="text-foreground">Écrit pour le dossier.</span>
              <br />
              Un wiki, pas un nuage.
            </h2>
            <div className="mt-16 grid gap-6 md:mt-32 lg:grid-cols-[auto_1fr]">
              <div className="sticky top-24 hidden h-fit w-56 lg:block">
                <div className="text-sm text-muted-foreground">Produit</div>
                <div className="-ml-4 mt-4 flex flex-col">
                  {features.map((feature, index) => (
                    <a
                      key={feature.id}
                      href={`#${feature.id}`}
                      className={
                        index === 0
                          ? "rounded-full px-4 py-2 text-sm"
                          : "rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                      }
                    >
                      {feature.label}
                    </a>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-16 md:gap-32">
                {features.map((feature) => (
                  <div
                    key={feature.id}
                    id={feature.id}
                    className="grid scroll-mt-32 gap-6 sm:grid-cols-2 md:grid-cols-5 lg:gap-12"
                  >
                    <div className="flex flex-col justify-between pb-4 md:col-span-2">
                      <div>
                        <h3 className="mb-6 text-sm font-medium text-muted-foreground">
                          {feature.label}
                        </h3>
                        <p className="text-balance text-lg font-medium text-muted-foreground">
                          <span className="text-foreground">
                            {feature.lead}
                          </span>{" "}
                          {feature.rest}
                        </p>
                      </div>
                      <ul className="mt-8 divide-y text-muted-foreground">
                        {feature.items.map((item) => (
                          <li
                            key={item.label}
                            className="flex items-center gap-3 py-3"
                          >
                            <item.icon className="size-4" />
                            {item.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <FeatureFrame id={feature.id} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:gap-12">
              <h2 className="max-w-md text-balance text-4xl font-medium tracking-tight lg:text-5xl">
                Un wiki pour chaque dossier.
              </h2>
              <div className="space-y-6 lg:space-y-12">
                <p className="text-balance text-lg text-muted-foreground">
                  Scribbly range les pages dans le dossier que vous choisissez.
                  Vous pouvez les ouvrir, les copier et les versionner sans
                  l’application.
                </p>
                <div className="grid gap-4 pt-6 sm:grid-cols-2">
                  <p className="text-balance text-lg text-muted-foreground">
                    <span className="font-medium text-foreground">
                      <Zap className="inline size-4 -translate-y-0.5" /> Direct.
                    </span>{" "}
                    De la note au fichier, sans compte et sans synchronisation.
                  </p>
                  <p className="text-balance text-lg text-muted-foreground">
                    <span className="font-medium text-foreground">
                      <HardDrive className="inline size-4 -translate-y-0.5" />{" "}
                      Local.
                    </span>{" "}
                    Le wiki, la corbeille et les médias restent sur la machine.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-6">
          <ReleasePanel show="journal" />
        </div>

        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex items-end justify-between gap-8 max-lg:flex-col max-lg:items-center max-lg:text-center">
              <h2 className="max-w-4xl text-balance text-5xl font-semibold tracking-tight text-muted-foreground xl:text-6xl">
                <span className="text-foreground">Écrire, à partir d’ici.</span>
                <br />
                Le dossier reste sur la machine.
              </h2>
              <Button
                className="h-10 shrink-0 rounded-full px-5 text-sm"
                render={<a href="/download" />}
              >
                Télécharger
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

const frames: Record<string, { src: string; alt: string }> = {
  fichiers: {
    src: "/shots/library.png",
    alt: "Bibliothèque des notes, avec le tableau des pages récentes",
  },
  editeur: {
    src: "/shots/editor.png",
    alt: "Éditeur ouvert sur une note Markdown",
  },
  chapitres: {
    src: "/shots/sidebar.png",
    alt: "Barre latérale avec un chapitre et ses notes",
  },
  machine: {
    src: "/shots/settings.png",
    alt: "Réglages d’écriture de l’application",
  },
};

function FeatureFrame({ id }: { id: string }) {
  const frame = frames[id];
  return (
    <div className="relative aspect-square overflow-hidden rounded-3xl border border-border/50 bg-foreground/2 md:col-span-3">
      {frame ? (
        <Image
          src={frame.src}
          alt={frame.alt}
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          className="object-cover object-left-top"
        />
      ) : null}
    </div>
  );
}
