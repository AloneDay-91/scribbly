import { openUrl } from "@tauri-apps/plugin-opener";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { PreviewCard, PreviewCardContent, PreviewCardTrigger } from "@/components/ui/PreviewCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Typography } from "@/components/ui/Typography";
import { resolveNoteHref, type NoteSummary } from "@/lib/notes";

type NotePreviewProps = {
  markdown: string;
  current: string;
  notes: NoteSummary[];
  fontSize: number;
  onOpenNote: (path: string, newTab?: boolean) => void;
};

export function NotePreview({ markdown, current, notes, fontSize, onOpenNote }: NotePreviewProps) {
  const components: Components = {
    table: ({ children }) => <Table className="not-typography">{children}</Table>,
    thead: ({ children }) => <TableHeader>{children}</TableHeader>,
    tbody: ({ children }) => <TableBody>{children}</TableBody>,
    tr: ({ children }) => <TableRow>{children}</TableRow>,
    th: ({ children }) => <TableHead>{children}</TableHead>,
    td: ({ children }) => <TableCell>{children}</TableCell>,
    a: ({ href, children }) => {
      const target = href ? resolveNoteHref(current, href) : null;
      if (target) {
        const title = notes.find((note) => note.path === target)?.title ?? target;
        return (
          <PreviewCard>
            <PreviewCardTrigger
              render={
                <button
                  type="button"
                  onClick={(event) => onOpenNote(target, event.metaKey || event.ctrlKey)}
                  onAuxClick={(event) => {
                    if (event.button === 1) {
                      event.preventDefault();
                      onOpenNote(target, true);
                    }
                  }}
                />
              }
            >
              {children}
            </PreviewCardTrigger>
            <PreviewCardContent>
              <p className="font-medium text-foreground">{title}</p>
              <p className="mt-1 font-mono text-muted-foreground">{target}</p>
            </PreviewCardContent>
          </PreviewCard>
        );
      }
      if (href && /^https?:\/\//i.test(href)) {
        return (
          <a
            href={href}
            onClick={(event) => {
              event.preventDefault();
              void openUrl(href);
            }}
          >
            {children}
          </a>
        );
      }
      return <span>{children}</span>;
    },
  };

  return (
    <Typography className="note max-w-3xl" style={{ fontSize }}>
      <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={components}>
        {markdown}
      </ReactMarkdown>
    </Typography>
  );
}
