import Image from "next/image"

const landscape =
  "https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0"

export function HeroPreview() {
  return (
    <div className="relative mt-16 overflow-hidden rounded-xl bg-muted px-4 pt-6 max-lg:-mx-4 md:px-6 lg:px-8 lg:pt-16">
      <div className="relative z-10 mx-auto flex aspect-3/2 max-w-5xl -space-x-12 sm:aspect-video lg:-space-x-56">
        <div className="w-2/3 pt-6 lg:pt-16">
          <div className="relative h-full overflow-hidden rounded-t-2xl bg-card shadow-2xl shadow-black/35 ring-1 ring-foreground/10">
            <Image
              src="/shots/library.png"
              alt=""
              fill
              sizes="(max-width: 768px) 60vw, 480px"
              className="object-cover object-left-top"
            />
          </div>
        </div>
        <div className="relative h-full w-2/3 overflow-hidden rounded-t-2xl bg-card shadow-2xl shadow-black/35 ring-1 ring-foreground/10">
          <Image
            src="/shots/editor.png"
            alt="Scribbly ouvert sur une note, devant le paysage"
            fill
            sizes="(max-width: 768px) 60vw, 640px"
            className="object-cover object-left-top"
          />
        </div>
      </div>
      <Image
        src={landscape}
        alt=""
        fill
        priority
        sizes="(max-width: 768px) 100vw, 1280px"
        className="object-cover"
      />
    </div>
  )
}
