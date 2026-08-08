import { Download, FileArchive, TerminalSquare } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const VL2_URL =
  "https://github.com/GeekOfWires/wilderzone-auxiliary/releases/download/whois-vl2/gowWhoisVpn.vl2";
const CLANS_VL2_URLS = {
  server:
    "https://github.com/GeekOfWires/wilderzone-auxiliary/releases/download/clans-vl2/wilderzoneClanQOL-server.vl2",
  clientQol:
    "https://github.com/GeekOfWires/wilderzone-auxiliary/releases/download/clans-vl2/wilderzoneClanQOL-client.vl2",
  clientRc:
    "https://github.com/GeekOfWires/wilderzone-auxiliary/releases/download/clans-vl2/wilderzoneClanRC-client.vl2",
};
const RELEASES_URL = "https://github.com/GeekOfWires/wilderzone-auxiliary/releases";

export function DownloadsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Downloads</h1>
        <p className="mb-8 text-muted-foreground">
          Client and server scripts for Tribes 2, built automatically from the repository on
          every change.
        </p>

        <Card className="border-l-4 border-l-emerald-400 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-emerald-400" />
              Wilderzone Clans
            </CardTitle>
            <CardDescription>
              In-game clan tags, clan browser, and T-Mail against the live TribesNEXT community
              APIs. The client vl2s add the browser and T-Mail UIs; the server vl2 shows clan tags
              on the scoreboard for all players. Drop into{" "}
              <code className="text-teal-500">GameData/base/</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href={CLANS_VL2_URLS.clientQol}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Client (QoL)
                </a>
              </Button>
              <Button asChild>
                <a href={CLANS_VL2_URLS.clientRc}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Client (RC2a)
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={CLANS_VL2_URLS.server}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Server (QoL)
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Pick the client vl2 for your patch generation: QoL patch (native crypto + HTTPS) or
              RC2a (Ruby bridge, plain HTTP). Servers need only the server vl2 - tags come from the
              Wilderzone Auxiliary tag API, no TribesNEXT account required.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6 border-l-4 border-l-emerald-400 bg-card/60">
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
