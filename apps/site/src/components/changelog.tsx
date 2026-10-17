import ReactMarkdown from "react-markdown"
import { Badge } from "@/components/ui/Badge"
import {
  Timeline,
  TimelineContent,
  TimelineItem,
  TimelineMarker,
  TimelineSeparator,
  TimelineTime,
  TimelineTitle,
} from "@/components/ui/Timeline"
import type { ChangelogEntry } from "@/lib/releases"

export function Changelog({ entries }: { entries: ChangelogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Le journal s’affichera ici dès qu’une version sera publiée sur GitHub.
      </p>
    )
  }

  return (
    <Timeline>
      {entries.map((entry) => (
        <TimelineItem key={entry.id}>
          <TimelineMarker />
          <TimelineSeparator />
          <TimelineContent>
            <div className="flex flex-wrap items-center gap-2">
              <TimelineTitle>
                <a href={entry.url} className="hover:underline">
                  {entry.title}
                </a>
              </TimelineTitle>
              <Badge variant="outline">{entry.tag}</Badge>
              {entry.prerelease ? <Badge variant="secondary">Préversion</Badge> : null}
            </div>
            {entry.dateLabel ? (
              <TimelineTime dateTime={entry.dateLabel}>{entry.dateLabel}</TimelineTime>
            ) : null}
            {entry.body ? (
              <div className="changelog text-xs leading-relaxed text-muted-foreground">
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {entry.body}
                </ReactMarkdown>
              </div>
            ) : null}
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  )
}
