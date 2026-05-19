"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
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

type DocumentUploadOption = {
  value: string;
  label: string;
};

export function documentTypeLabel(value: string) {
  if (value === "aadhaar") return "Aadhaar card";
  if (value === "smart_card") return "Smart card";
  return value.replace(/_/g, " ");
}

export function DocumentUploadDialog({
  description,
  docType,
  hiddenFields,
  onOpenChange,
  onSubmit,
  open,
  options,
  setDocType,
  title,
}: {
  description?: string;
  docType: string;
  hiddenFields: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData, context: { docType: string; fileName: string }) => Promise<boolean>;
  open: boolean;
  options: DocumentUploadOption[];
  setDocType: (value: string) => void;
  title: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const selectedType = String(formData.get("doc_type") || docType);
            const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
            const fileName = fileInput?.files?.[0]?.name ?? "";
            setPending(true);
            const ok = await onSubmit(formData, { docType: selectedType, fileName });
            setPending(false);
            if (ok) {
              form.reset();
              onOpenChange(false);
            }
          }}
        >
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="space-y-2">
            <Label htmlFor="document_upload_type" required>Document type</Label>
            <select
              id="document_upload_type"
              name="doc_type"
              value={docType}
              onChange={(event) => setDocType(event.target.value)}
              required
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="document_upload_file" required>File</Label>
            <Input id="document_upload_file" name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png" />
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="bg-accent text-accent-foreground">
              <Upload className="size-4" />
              {pending ? "Uploading..." : "Upload document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
