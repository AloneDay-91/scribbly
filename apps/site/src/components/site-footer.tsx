const systems = ["macOS", "Windows", "Debian", "Fedora"]

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-7xl space-y-16 px-6 pt-32 pb-6">
        <div className="grid grid-cols-2 gap-x-3 gap-y-12 sm:grid-cols-4">
          <div className="col-span-full sm:col-span-2">
            <a href="/" className="text-sm font-medium">
              Scribbly
            </a>
          </div>
          <FooterColumn
            title="Produit"
            links={[
              ["Fonctionnalités", "/#produit"],
              ["Télécharger", "/download"],
              ["Journal", "/#journal"],
            ]}
          />
          <FooterColumn
            title="Systèmes"
            links={systems.map((name) => [name, "/download"])}
          />
        </div>
        <div className="mt-24 grid gap-6 border-t pt-6 sm:grid-cols-2">
          <a
            href="https://github.com/AloneDay-91/scribbly"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            GitHub
          </a>
          <span className="text-sm text-muted-foreground sm:text-right">100 % local</span>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: [string, string][]
}) {
  return (
    <div>
      <span className="text-sm text-foreground">{title}</span>
      <ul className="mt-4 list-inside space-y-4">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="text-sm text-muted-foreground duration-150 hover:text-foreground">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
