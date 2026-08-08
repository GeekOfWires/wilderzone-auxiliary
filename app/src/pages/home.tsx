import { Link } from "react-router-dom";
import { FlaskConical, Globe, Network, Sparkles, Users } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-4 pb-20 pt-10 text-center">
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

        {/* Clans passthrough */}
        <section className="border-t">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-4 px-4 py-16">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <Users className="h-4 w-4" />
              Now interfacing
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Clan Tags, Proxied</h2>
            <p className="max-w-2xl text-muted-foreground">
              Clan tags on a 2001 engine, with a security model that holds up: each game server
              authenticates to Wilderzone Auxiliary with its own revocable API key, and the
              service proxies the lookup to the live TribesNEXT community database. The worker
              holds the only community account - server operators never need TribesNEXT
              credentials, players never send a password anywhere, and every answer is cached
              and rate-limited per server. One line comes back: the player's community name,
              their tag, and where the tag goes.
            </p>
            <p className="max-w-2xl text-muted-foreground">
              Pair it with the Wilderzone Clans server vl2 and every player - modded client or
              not - shows up on the scoreboard wearing their community tag, with local overrides
              for tournament rosters and staff. The client vl2s build on the same community
              session to bring back the in-game clan browser and T-Mail.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/downloads">Get the clans vl2s</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://geekofwires.github.io/wilderzone-auxiliary/api-reference"
                  target="_blank"
                  rel="noreferrer"
                >
                  API reference
                </a>
              </Button>
            </div>
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
