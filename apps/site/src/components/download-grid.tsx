"use client"

import { useSyncExternalStore } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"
import type { PlatformId, PlatformOffer } from "@/lib/releases"

function PlatformIcon({ id }: { id: PlatformId }) {
  const common = { viewBox: "0 0 24 24", className: "size-6", "aria-hidden": true } as const
  switch (id) {
    case "macos":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
        </svg>
      )
    case "debian":
      return (
        <svg {...common} fill="currentColor">
          <path d="M13.88 12.685c-.4 0 .08.2.601.28.14-.1.27-.22.39-.33a3.001 3.001 0 01-.99.05m2.14-.53c.23-.33.4-.69.47-1.06-.06.27-.2.5-.33.73-.75.47-.07-.27 0-.56-.8 1.01-.11.6-.14.89m.781-2.05c.05-.721-.14-.501-.2-.221.07.04.13.5.2.22M12.38.31c.2.04.45.07.42.12.23-.05.28-.1-.43-.12m.43.12l-.15.03.14-.01V.43m6.633 9.944c.02.64-.2.95-.38 1.5l-.35.181c-.28.54.03.35-.17.78-.44.39-1.34 1.22-1.62 1.301-.201 0 .14-.25.19-.34-.591.4-.481.6-1.371.85l-.03-.06c-2.221 1.04-5.303-1.02-5.253-3.842-.03.17-.07.13-.12.2a3.551 3.552 0 012.001-3.501 3.361 3.362 0 013.732.48 3.341 3.342 0 00-2.721-1.3c-1.18.01-2.281.76-2.651 1.57-.6.38-.67 1.47-.93 1.661-.361 2.601.66 3.722 2.38 5.042.27.19.08.21.12.35a4.702 4.702 0 01-1.53-1.16c.23.33.47.66.8.91-.55-.18-1.27-1.3-1.48-1.35.93 1.66 3.78 2.921 5.261 2.3a6.203 6.203 0 01-2.33-.28c-.33-.16-.77-.51-.7-.57a5.802 5.803 0 005.902-.84c.44-.35.93-.94 1.07-.95-.2.32.04.16-.12.44.44-.72-.2-.3.46-1.24l.24.33c-.09-.6.74-1.321.66-2.262.19-.3.2.3 0 .97.29-.74.08-.85.15-1.46.08.2.18.42.23.63-.18-.7.2-1.2.28-1.6-.09-.05-.28.3-.32-.53 0-.37.1-.2.14-.28-.08-.05-.26-.32-.38-.861.08-.13.22.33.34.34-.08-.42-.2-.75-.2-1.08-.34-.68-.12.1-.4-.3-.34-1.091.3-.25.34-.74.54.77.84 1.96.981 2.46-.1-.6-.28-1.2-.49-1.76.16.07-.26-1.241.21-.37A7.823 7.824 0 0017.702 1.6c.18.17.42.39.33.42-.75-.45-.62-.48-.73-.67-.61-.25-.65.02-1.06 0C15.082.73 14.862.8 13.8.4l.05.23c-.77-.25-.9.1-1.73 0-.05-.04.27-.14.53-.18-.741.1-.701-.14-1.431.03.17-.13.36-.21.55-.32-.6.04-1.44.35-1.18.07C9.6.68 7.847 1.3 6.867 2.22L6.838 2c-.45.54-1.96 1.611-2.08 2.311l-.131.03c-.23.4-.38.85-.57 1.261-.3.52-.45.2-.4.28-.6 1.22-.9 2.251-1.16 3.102.18.27 0 1.65.07 2.76-.3 5.463 3.84 10.776 8.363 12.006.67.23 1.65.23 2.49.25-.99-.28-1.12-.15-2.08-.49-.7-.32-.85-.7-1.34-1.13l.2.35c-.971-.34-.57-.42-1.361-.67l.21-.27c-.31-.03-.83-.53-.97-.81l-.34.01c-.41-.501-.63-.871-.61-1.161l-.111.2c-.13-.21-1.52-1.901-.8-1.511-.13-.12-.31-.2-.5-.55l.14-.17c-.35-.44-.64-1.02-.62-1.2.2.24.32.3.45.33-.88-2.172-.93-.12-1.601-2.202l.15-.02c-.1-.16-.18-.34-.26-.51l.06-.6c-.63-.74-.18-3.102-.09-4.402.07-.54.53-1.1.88-1.981l-.21-.04c.4-.71 2.341-2.872 3.241-2.761.43-.55-.09 0-.18-.14.96-.991 1.26-.7 1.901-.88.7-.401-.6.16-.27-.151 1.2-.3.85-.7 2.421-.85.16.1-.39.14-.52.26 1-.49 3.151-.37 4.562.27 1.63.77 3.461 3.011 3.531 5.132l.08.02c-.04.85.13 1.821-.17 2.711l.2-.42M9.54 13.236l-.05.28c.26.35.47.73.8 1.01-.24-.47-.42-.66-.75-1.3m.62-.02c-.14-.15-.22-.34-.31-.52.08.32.26.6.43.88l-.12-.36m10.945-2.382l-.07.15c-.1.76-.34 1.511-.69 2.212.4-.73.65-1.541.75-2.362M12.45.12c.27-.1.66-.05.95-.12-.37.03-.74.05-1.1.1l.15.02M3.006 5.142c.07.57-.43.8.11.42.3-.66-.11-.18-.1-.42m-.64 2.661c.12-.39.15-.62.2-.84-.35.44-.17.53-.2.83" />
        </svg>
      )
    case "fedora":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12.001 0C5.376 0 .008 5.369.004 11.992H.002v9.287h.002A2.726 2.726 0 0 0 2.73 24h9.275c6.626-.004 11.993-5.372 11.993-11.997C23.998 5.375 18.628 0 12 0zm2.431 4.94c2.015 0 3.917 1.543 3.917 3.671 0 .197.001.395-.03.619a1.002 1.002 0 0 1-1.137.893 1.002 1.002 0 0 1-.842-1.175 2.61 2.61 0 0 0 .013-.337c0-1.207-.987-1.672-1.92-1.672-.934 0-1.775.784-1.777 1.672.016 1.027 0 2.046 0 3.07l1.732-.012c1.352-.028 1.368 2.009.016 1.998l-1.748.013c-.004.826.006.677.002 1.093 0 0 .015 1.01-.016 1.776-.209 2.25-2.124 4.046-4.424 4.046-2.438 0-4.448-1.993-4.448-4.437.073-2.515 2.078-4.492 4.603-4.469l1.409-.01v1.996l-1.409.013h-.007c-1.388.04-2.577.984-2.6 2.47a2.438 2.438 0 0 0 2.452 2.439c1.356 0 2.441-.987 2.441-2.437l-.001-7.557c0-.14.005-.252.02-.407.23-1.848 1.883-3.256 3.754-3.256z" />
        </svg>
      )
    case "windows":
      return (
        <svg {...common} fill="currentColor">
          <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623" />
        </svg>
      )
    default: {
      const unreachable: never = id
      return unreachable
    }
  }
}

function detectPlatform(): PlatformId | null {
  const ua = navigator.userAgent
  if (/Mac/i.test(ua)) return "macos"
  if (/Win/i.test(ua)) return "windows"
  return null
}

function DownloadAction({ files }: { files: PlatformOffer["files"] }) {
  if (files.length === 0) {
    return (
      <Button className="h-9 w-full rounded-full text-sm" variant="outline" disabled>
        Pas encore publié
      </Button>
    )
  }

  if (files.length === 1) {
    const file = files[0]
    return (
      <Button className="h-9 w-full rounded-full text-sm" render={<a href={file.url} />}>
        Télécharger
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button className="h-9 w-full rounded-full text-sm" />}>
        Télécharger
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {files.map((file) => (
          <DropdownMenuLinkItem key={file.name} href={file.url}>
            <span className="truncate">{file.label}</span>
            <span className="ml-auto pl-3 text-muted-foreground">{file.sizeLabel}</span>
          </DropdownMenuLinkItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function subscribe() {
  return () => {}
}

export function DownloadGrid({ platforms }: { platforms: PlatformOffer[] }) {
  const current = useSyncExternalStore(subscribe, detectPlatform, () => null)

  return (
    <div className="grid gap-6 border *:p-8 max-lg:mx-auto max-lg:max-w-sm lg:grid-cols-4">
      {platforms.map((platform) => {
        const here = platform.id === current
        return (
          <Card
            key={platform.id}
            className="relative flex h-full flex-col gap-8 rounded-none border-0 bg-transparent py-0 shadow-none max-lg:border-b lg:border-r lg:last:border-r-0"
          >
            {here ? (
              <Badge
                variant="secondary"
                className="absolute top-0 right-0 rounded-bl px-3 py-1"
              >
                Ici
              </Badge>
            ) : null}
            <CardHeader className="px-0">
              <PlatformIcon id={platform.id} />
              <CardTitle className="text-lg font-medium">{platform.name}</CardTitle>
              <CardDescription className="text-lg">{platform.detail}</CardDescription>
            </CardHeader>
            {platform.files.length > 0 ? (
              <ul className="text-sm">
                {platform.files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-baseline justify-between gap-3 border-t border-border py-2"
                  >
                    <span className="min-w-0 truncate">{file.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {file.sizeLabel}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <CardFooter className="mt-auto w-full px-0">
              <DownloadAction files={platform.files} />
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
