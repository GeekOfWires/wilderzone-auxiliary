import { Check, Copy } from "lucide-react";
import { useState } from "react";
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

interface Props {
  /** null hides the dialog */
  value: { key: string; name: string } | null;
  onClose: () => void;
}

/** Copy-once dialog shown right after a key is minted (create or approve). */
export function KeyRevealDialog({ value, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value.key);
      setCopied(true);
      toast.success("Key copied to clipboard");
    } catch {
      toast.error("Copy failed — select and copy the key manually");
    }
  };

  return (
    <Dialog open={value !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Key created: {value?.name}</DialogTitle>
          <DialogDescription>
            Copy this key now. It will <span className="font-semibold">not</span> be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded-md bg-muted p-3 font-mono text-sm">
            {value?.key}
          </code>
          <Button variant="outline" size="icon" onClick={() => void copy()} title="Copy key">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
