import { Link } from "react-router-dom";
import { BookOpen, Code2, Download, FileArchive, TerminalSquare } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const VL2_URL =
  "https://github.com/GeekOfWires/wilderzone-auxiliary/releases/download/whois-vl2/gowWhoisVpn.vl2";
const RELEASES_URL = "https://github.com/GeekOfWires/wilderzone-auxiliary/releases";

export function DownloadsPage() {
  return (
    <div className="flex min-h-screen flex-col">
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Downloads</h1>
        <p className="mb-8 text-muted-foreground">
          Server-side scripts for your Tribes 2 server, built automatically from the repository on
          every change.
        </p>

        <Card className="border-l-4 border-l-emerald-400 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-emerald-400" />
              gowWhoisVpn.vl2
            </CardTitle>
            <CardDescription>
              Whois lookup + VPN auto-kick for TacoClassic servers, wired to this service. Drop the
              file into <code className="text-teal-500">GameData/Classic/</code> and restart - the
              engine auto-execs it from <code className="text-teal-500">scripts/autoexec/</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href={VL2_URL}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Download latest
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={RELEASES_URL} target="_blank" rel="noreferrer">
                  All releases
                </a>
              </Button>
            </div>

            <div className="rounded-md border bg-background/60 p-4 font-mono text-xs leading-relaxed">
              <div className="mb-2 flex items-center gap-2 font-sans text-sm text-muted-foreground">
                <TerminalSquare className="h-4 w-4" />
                GameData/Classic/prefs/serverPrefs.cs
              </div>
              <pre className="whitespace-pre-wrap text-emerald-500">
{`// optional - defaults work out of the box:
// $Host::WhoisApiKey = "wza_...";           // your server-role key
// $Host::AutoKickVPNs = 1;                  // auto-kick flagged players
// $Host::AutoKickAnnounce = "\\c2%1 has left the game.";`}
              </pre>
            </div>

            <p className="text-xs text-muted-foreground">
              Super admins get <code className="text-teal-500">/whois &lt;name&gt;</code> in chat
              and a <span className="text-foreground">Whois Lookup</span> entry in the player
              right-click menu, with smurf detection using TacoClassic's own process.
            </p>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 text-xs text-muted-foreground">
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
