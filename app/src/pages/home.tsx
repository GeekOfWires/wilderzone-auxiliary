import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg border-l-4 border-l-emerald-400 text-center">
        <CardHeader className="items-center gap-4">
          <Logo height={64} />
          <CardDescription className="text-base">
            Background interfacing for <span className="font-semibold text-teal-500">Tribes 2</span>{" "}
            multiplayer servers — VPN/proxy screening with player geolocation verdicts, API keys,
            and a rolling query log, built for the TribesNEXT QoL patch.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/login">Login</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://geekofwires.github.io/wilderzone-auxiliary/" target="_blank" rel="noreferrer">
                Documentation
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Maintained by{" "}
            <a className="text-teal-500 hover:underline" href="https://github.com/GeekOfWires" target="_blank" rel="noreferrer">
              GeekOfWires
            </a>{" "}
            ·{" "}
            <a
              className="text-teal-500 hover:underline"
              href="https://github.com/GeekOfWires/wilderzone-auxiliary"
              target="_blank"
              rel="noreferrer"
            >
              Source on GitHub
            </a>{" "}
            · Tribes 2 lives at{" "}
            <a className="text-teal-500 hover:underline" href="https://www.tribesnext.com" target="_blank" rel="noreferrer">
              TribesNEXT
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
