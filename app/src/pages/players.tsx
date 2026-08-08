import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, toastApiError } from "@/lib/api";
import type { PlayerResult } from "@/lib/types";

interface PlayersResponse {
  q: string;
  players: PlayerResult[];
}

export function PlayersPage() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<PlayersResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    try {
      const res = await api<PlayersResponse>(`/api/players?q=${encodeURIComponent(query)}`);
      setData(res);
    } catch (err) {
      toastApiError(err, "Player search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Player Lookup</h1>
        <span className="text-xs text-muted-foreground">
          Live TribesNEXT community database · prefix search
        </span>
      </div>

      <form className="flex items-end gap-2" onSubmit={(e) => void search(e)}>
        <div className="space-y-2">
          <Label htmlFor="players-q">Player name</Label>
          <Input
            id="players-q"
            placeholder="Name prefix…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64"
          />
        </div>
        <Button type="submit" variant="outline" disabled={loading || !q.trim()}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Search
        </Button>
      </form>

      {data &&
        (data.players.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
            No players match "{data.q}".
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {data.players.length} player(s) matching "{data.q}"
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>GUID</TableHead>
                  <TableHead>Clan tag</TableHead>
                  <TableHead>Placement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.players.map((p) => (
                  <TableRow key={p.guid}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.guid}</TableCell>
                    <TableCell>
                      {p.tag ? (
                        <span className="font-mono text-sm">{p.tag}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.tag ? (
                        p.append === 0 ? (
                          <Badge variant="secondary">prepend</Badge>
                        ) : (
                          <Badge variant="secondary">postpend</Badge>
                        )
                      ) : (
                        <Badge variant="outline">no clan</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ))}
    </div>
  );
}
