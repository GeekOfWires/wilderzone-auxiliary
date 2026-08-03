import { Link } from "react-router-dom";
import { BookOpen, Code2, Download, FlaskConical, Globe, Network, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4">
          <Link to="/" aria-label="Home">
            <Logo height={72} />
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
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-4 py-20 text-center">
            <Logo height={120} />
            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                What if a game server could ask the outside world questions?
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Wilderzone Auxiliary Services is an experiment in exactly that - giving Tribes 2
                servers better ways to interface with things beyond the game. Not a product, more
                of a what-if: small server-side scripts that can lean on an outside service when
                the engine alone isn't enough.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" variant="outline" asChild>
                <a href="https://geekofwires.github.io/wilderzone-auxiliary/" target="_blank" rel="noreferrer">
                  Read the docs
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/downloads">Downloads</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* The idea */}
        <section className="mx-auto w-full max-w-4xl px-4 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-5 w-5 text-emerald-400" />
                  Game servers are islands
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                A 2001 engine sees players, maps, and not much else. There's a whole internet of
                context it can't reach on its own - and doesn't have to.
              </CardContent>
            </Card>
            <Card className="bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Network className="h-5 w-5 text-emerald-400" />
                  A bridge, not a rebuild
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                The interesting question isn't changing the game - it's what becomes possible when a
                stock server can make simple outside calls and act on the answers.
              </CardContent>
            </Card>
            <Card className="bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                  Room to grow
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Anything a game server might want to ask or offload is fair game. Each new idea just
                becomes another auxiliary function hanging off the same bridge.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Currently exploring */}
        <section className="border-t">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-4 px-4 py-16">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <FlaskConical className="h-4 w-4" />
              Currently exploring
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Whois lookups</h2>
            <p className="max-w-2xl text-muted-foreground">
              The first experiment on the bridge: letting a server ask about the players connecting
              to it. Admins get a right-click answer on anyone in the server, and the door can
              quietly close itself on connections you'd rather not host. It runs today - there's a
              small script for your server and an API behind it doing the heavy lifting.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://geekofwires.github.io/wilderzone-auxiliary/api-reference"
                  target="_blank"
                  rel="noreferrer"
                >
                  API reference
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/downloads">Get the server script</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              More auxiliary functions as the what-ifs pile up.
            </p>
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
