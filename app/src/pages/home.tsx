import { Link } from "react-router-dom";
import {
  BookOpen,
  Download,
  Code2,
  Globe,
  KeyRound,
  ListFilter,
  ScrollText,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "VPN & Proxy Screening",
    body: "Every player IP checked against curated VPN-provider CIDR lists and ip-api's proxy flag. Verdicts in milliseconds, cached at the edge.",
  },
  {
    icon: Globe,
    title: "Geolocation Verdicts",
    body: "Country, region, city, ISP, org, and ASN per player - everything a server admin needs to know who they're really hosting.",
  },
  {
    icon: ListFilter,
    title: "Pluggable CIDR Sources",
    body: "X4BNet's VPN list out of the box, refreshed daily. Add your own lists with format mappings for lines, CSV, or JSON.",
  },
  {
    icon: KeyRound,
    title: "API Keys & Roles",
    body: "Public keys rate-limited per requesting IP, unlimited server keys for your game servers, admin keys for automation.",
  },
  {
    icon: ScrollText,
    title: "48h Query Log",
    body: "Player names and GUIDs on every check. Clean hits keep nothing else; VPN hits keep the matched CIDR and context.",
  },
  {
    icon: Zap,
    title: "Auto-Enforcement",
    body: "Pairs with the server-side script to quietly auto-kick flagged players on connect - no drama, just a disconnect reason.",
  },
];

export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link to="/" aria-label="Home">
            <Logo height={40} />
          </Link>
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/downloads">
                <Download className="mr-1.5 h-4 w-4" />
                Downloads
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="https://geekofwires.github.io/wilderzone-auxiliary/" target="_blank" rel="noreferrer">
                <BookOpen className="mr-1.5 h-4 w-4" />
                Docs
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="https://github.com/GeekOfWires/wilderzone-auxiliary" target="_blank" rel="noreferrer">
                <Code2 className="mr-1.5 h-4 w-4" />
                GitHub
              </a>
            </Button>
            <Button size="sm" asChild className="ml-2">
              <Link to="/login">Login</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:py-24">
            <div className="space-y-6">
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Background interfacing for{" "}
                <span className="text-teal-500">Tribes 2</span> servers
              </h1>
              <p className="max-w-lg text-lg text-muted-foreground">
                One HTTPS call per player IP returns geolocation, ISP and ASN, proxy flags, and a
                VPN-provider verdict as a single tab-separated line - built to be absorbed by a
                2001 game engine.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/login">Login</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="https://geekofwires.github.io/wilderzone-auxiliary/" target="_blank" rel="noreferrer">
                    Read the docs
                  </a>
                </Button>
              </div>
            </div>

            {/* API teaser */}
            <Card className="border-l-4 border-l-emerald-400 bg-card/60 font-mono text-xs leading-relaxed">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-sans text-sm">
                  <Server className="h-4 w-4 text-emerald-400" />
                  One call, one line
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 overflow-x-auto">
                <div className="text-muted-foreground">
                  GET /tribes-api/check?ip=203.0.113.50
                </div>
                <pre className="whitespace-pre text-emerald-500">
{`OK\t1\t1\t0\t5.134.116.0/24\tUS\tCalifornia\tSacramento\tM247 Ltd\tM247 Ltd\tAS9009`}
                </pre>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>status · flagged</span>
                  <span>proxy · hosting</span>
                  <span>matched CIDR</span>
                  <span>country · region · city</span>
                  <span>isp · org · asn</span>
                  <span className="text-teal-500">parsed with getField()</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="mb-2 text-2xl font-bold tracking-tight">What it does</h2>
          <p className="mb-8 max-w-2xl text-muted-foreground">
            Purpose-built for Tribes 2 server operators running the TribesNEXT QoL patch, with an
            admin panel to manage it all.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="bg-card/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-5 w-5 text-emerald-400" />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="mb-8 text-2xl font-bold tracking-tight">How it works</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Player connects",
                  body: "Your Tribes 2 server asks Wilderzone Auxiliary Services about the IP - with the player's name and GUID attached for the log.",
                },
                {
                  step: "2",
                  title: "We check everything",
                  body: "VPN-provider CIDR lists (refreshed daily), ip-api proxy/hosting flags, and geolocation - resolved and cached at the edge.",
                },
                {
                  step: "3",
                  title: "One line back",
                  body: "A single tab-separated verdict your server reads with getField. Flagged players can be auto-kicked; everything lands in the 48h query log.",
                },
              ].map(({ step, title, body }) => (
                <div key={step} className="space-y-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/15 font-bold text-emerald-400">
                    {step}
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>
            Maintained by{" "}
            <a className="text-teal-500 hover:underline" href="https://github.com/GeekOfWires" target="_blank" rel="noreferrer">
              GeekOfWires
            </a>{" "}
            · MIT License
          </span>
          <span>
            Tribes 2 lives at{" "}
            <a className="text-teal-500 hover:underline" href="https://www.tribesnext.com" target="_blank" rel="noreferrer">
              TribesNEXT
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
