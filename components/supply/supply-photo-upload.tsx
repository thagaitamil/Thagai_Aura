"use client";

import { useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { uploadSupplyDocument } from "@/lib/actions/supply";

export function SupplyPhotoUpload({
  supplyId,
  initialUrl,
}: {
  supplyId: string;
  initialUrl: string | null;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max photo size is 5 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPG, PNG, etc.).");
      return;
    }

    // Show preview immediately
    const localUrl = URL.createObjectURL(file);
    setPhotoUrl(localUrl);
    setUploading(true);

    const fd = new FormData();
    fd.set("supply_id", supplyId);
    fd.set("doc_type", "photo");
    fd.set("file", file);

    const res = await uploadSupplyDocument(fd);
    setUploading(false);

    if (res.error) {
      toast.error(res.error);
      setPhotoUrl(initialUrl); // revert on error
    } else {
      toast.success("Photo uploaded");
      startTransition(() => { router.refresh(); });
    }

    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="shrink-0 relative group cursor-pointer" onClick={() => inputRef.current?.click()}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFile}
      />

      {/* Avatar circle */}
      <div className="relative size-16 rounded-full overflow-hidden border-2 border-border/80 shadow-sm bg-muted">
        {photoUrl ? (
          <Image src={photoUrl} alt="Profile photo" fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <UserCircle className="size-8 text-muted-foreground/50" />
          </div>
        )}

        {/* Hover overlay */}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <Loader2 className="size-5 text-white animate-spin" />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 group-hover:bg-black/50 rounded-full transition-colors">
            <Camera className="size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 font-medium">
              Upload
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
