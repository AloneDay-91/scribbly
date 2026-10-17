import Image from "next/image"

export const productShots = [
  {
    src: "/shots/editor.png",
    title: "Éditeur",
    components: "Typography, Breadcrumb",
    alt: "Note ouverte dans l’éditeur, avec le sommaire à droite",
    width: 1440,
    height: 900,
  },
  {
    src: "/shots/library.png",
    title: "Bibliothèque",
    components: "Table, Badge, Button, Kbd",
    alt: "Bibliothèque des notes, avec les actions rapides et le tableau des pages récentes",
    width: 1440,
    height: 900,
  },
  {
    src: "/shots/sidebar.png",
    title: "Barre latérale",
    components: "Sidebar, Menu, Kbd",
    alt: "Barre latérale avec le chapitre, la recherche et le compte",
    width: 256,
    height: 900,
  },
  {
    src: "/shots/palette.png",
    title: "Recherche",
    components: "Command, Dialog, Kbd",
    alt: "Palette de commandes ouverte sur les notes et les actions",
    width: 1440,
    height: 900,
  },
  {
    src: "/shots/settings.png",
    title: "Écriture",
    components: "Slider, NumberField, Separator",
    alt: "Réglages d’écriture, avec le curseur de taille et l’objectif de mots",
    width: 1440,
    height: 900,
  },
  {
    src: "/shots/dialog.png",
    title: "Nouvelle note",
    components: "Dialog, Field, Select, Button",
    alt: "Dialogue de création d’une note, avec le titre et le dossier",
    width: 1440,
    height: 900,
  },
] as const

export function ProductShot({
  shot,
}: {
  shot: (typeof productShots)[number]
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-lg">
      <Image
        src={shot.src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        className="h-auto w-full"
      />
      <figcaption className="space-y-1 border-t px-4 py-3">
        <div className="text-sm font-medium">{shot.title}</div>
        <div className="text-sm text-muted-foreground">{shot.components}</div>
      </figcaption>
    </figure>
  )
}
