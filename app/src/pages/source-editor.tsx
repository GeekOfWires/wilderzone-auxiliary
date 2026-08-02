import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, errorMessage } from "@/lib/api";
import type { Source, SourceFormat, SourceFormatType } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → create mode */
  source: Source | null;
  onSaved: () => void;
}

function parseFormat(format: string): SourceFormat {
  try {
    const parsed = JSON.parse(format) as SourceFormat;
    if (parsed && typeof parsed.type === "string") return parsed;
  } catch {
    // fall through
  }
  return { type: "cidr-lines", skipPrefix: "#" };
}

export function SourceEditorDialog({ open, onOpenChange, source, onSaved }: Props) {
  const editing = source !== null;

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [formatType, setFormatType] = useState<SourceFormatType>("cidr-lines");
  const [skipPrefix, setSkipPrefix] = useState("#");
  const [ipColumn, setIpColumn] = useState("");
  const [cidrColumn, setCidrColumn] = useState("");
  const [delimiter, setDelimiter] = useState(",");
  const [hasHeader, setHasHeader] = useState(false);
  const [jsonPath, setJsonPath] = useState("items[*].ip");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Populate/reset the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(source?.name ?? "");
    setUrl(source?.url ?? "");
    setEnabled(source ? source.enabled === 1 : true);
    const fmt = source ? parseFormat(source.format) : { type: "cidr-lines" as const, skipPrefix: "#" };
    setFormatType(fmt.type);
    setSkipPrefix(fmt.skipPrefix ?? "#");
    setIpColumn(fmt.ipColumn !== undefined ? String(fmt.ipColumn) : "");
    setCidrColumn(fmt.cidrColumn !== undefined ? String(fmt.cidrColumn) : "");
    setDelimiter(fmt.delimiter ?? ",");
    setHasHeader(fmt.hasHeader ?? false);
    setJsonPath(fmt.path ?? "items[*].ip");
  }, [open, source]);

  const format: SourceFormat = { type: formatType };
  if (formatType === "cidr-lines" || formatType === "ip-lines") {
    if (skipPrefix) format.skipPrefix = skipPrefix;
  } else if (formatType === "csv") {
    if (ipColumn.trim() !== "") format.ipColumn = Number(ipColumn);
    if (cidrColumn.trim() !== "") format.cidrColumn = Number(cidrColumn);
    if (delimiter !== ",") format.delimiter = delimiter;
    if (hasHeader) format.hasHeader = true;
  } else if (formatType === "json") {
    format.path = jsonPath;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (formatType === "csv" && format.ipColumn === undefined && format.cidrColumn === undefined) {
      setError("CSV format needs an IP column or a CIDR column.");
      return;
    }
    if (formatType === "json" && !jsonPath.trim()) {
      setError("JSON format needs a path, e.g. items[*].ip");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api(`/api/sources/${source.id}`, {
          method: "PUT",
          body: { name, url, format, enabled },
        });
        toast.success("Source updated");
      } else {
        await api("/api/sources", {
          method: "POST",
          body: { name, url, format, enabled },
        });
        toast.success("Source created");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit source" : "Add source"}</DialogTitle>
          <DialogDescription>A remote CIDR/IP list fetched on a schedule.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="src-name">Name</Label>
            <Input id="src-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="src-url">URL</Label>
            <Input
              id="src-url"
              type="url"
              placeholder="https://example.org/list.txt"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="src-enabled" checked={enabled} onCheckedChange={setEnabled} />
            <Label htmlFor="src-enabled">Enabled</Label>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={formatType} onValueChange={(v) => setFormatType(v as SourceFormatType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cidr-lines">cidr-lines — one CIDR per line</SelectItem>
                <SelectItem value="ip-lines">ip-lines — one bare IP per line</SelectItem>
                <SelectItem value="csv">csv — delimited columns</SelectItem>
                <SelectItem value="json">json — JSON array path</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formatType === "cidr-lines" || formatType === "ip-lines") && (
            <div className="space-y-2">
              <Label htmlFor="src-skip">Skip prefix (comment marker)</Label>
              <Input
                id="src-skip"
                value={skipPrefix}
                onChange={(e) => setSkipPrefix(e.target.value)}
                placeholder="#"
              />
            </div>
          )}

          {formatType === "csv" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="src-ipcol">IP column index</Label>
                <Input
                  id="src-ipcol"
                  type="number"
                  min={0}
                  value={ipColumn}
                  onChange={(e) => setIpColumn(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="src-cidrcol">CIDR column index</Label>
                <Input
                  id="src-cidrcol"
                  type="number"
                  min={0}
                  value={cidrColumn}
                  onChange={(e) => setCidrColumn(e.target.value)}
                  placeholder="wins over IP column"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="src-delim">Delimiter</Label>
                <Input
                  id="src-delim"
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  maxLength={1}
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch id="src-header" checked={hasHeader} onCheckedChange={setHasHeader} />
                <Label htmlFor="src-header">Has header row</Label>
              </div>
            </div>
          )}

          {formatType === "json" && (
            <div className="space-y-2">
              <Label htmlFor="src-path">JSON path</Label>
              <Input
                id="src-path"
                value={jsonPath}
                onChange={(e) => setJsonPath(e.target.value)}
                placeholder="items[*].ip"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Format preview</Label>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(format, null, 2)}
            </pre>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
