"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  completeUpload,
  requestUpload,
  resumeMultipartUpload,
} from "@/app/actions/media";
import { uploadMultipart } from "@/lib/upload/multipart";
import { buttonSecondary, hintClass, inputClass, labelClass } from "@/components/ui";
import { formatBytes } from "@/lib/labels";

function readMediaMetadata(file: File): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
  if (file.type.startsWith("image/")) {
    return createImageBitmap(file)
      .then((bitmap) => {
        const result = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return result;
      })
      .catch(() => ({}));
  }
  if (file.type.startsWith("video/")) {
    return new Promise((resolve) => {
      const element = document.createElement("video");
      element.preload = "metadata";
      element.onloadedmetadata = () => {
        resolve({
          width: element.videoWidth,
          height: element.videoHeight,
          durationSeconds: Number.isFinite(element.duration) ? element.duration : undefined,
        });
        URL.revokeObjectURL(element.src);
      };
      element.onerror = () => resolve({});
      element.src = URL.createObjectURL(file);
    });
  }
  if (file.type.startsWith("audio/")) {
    return new Promise((resolve) => {
      const element = document.createElement("audio");
      element.preload = "metadata";
      element.onloadedmetadata = () => {
        resolve({
          durationSeconds: Number.isFinite(element.duration) ? element.duration : undefined,
        });
        URL.revokeObjectURL(element.src);
      };
      element.onerror = () => resolve({});
      element.src = URL.createObjectURL(file);
    });
  }
  return Promise.resolve({});
}

type PendingUpload = {
  id: string;
  filename: string;
  sizeBytes: number;
  partCount: number;
  createdAt: Date | string;
};

export function MediaUploader({
  sessionId,
  pendingUploads,
}: {
  sessionId: string;
  pendingUploads: PendingUpload[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resumeTarget, setResumeTarget] = useState<PendingUpload | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function resume(file: File, upload: PendingUpload) {
    setError(null);
    if (file.size !== upload.sizeBytes) {
      setError("Choose the original file size to resume this upload.");
      return;
    }
    setStatus(`Resuming ${upload.filename}...`);
    const contentType = file.type || "application/octet-stream";
    const ticket = await resumeMultipartUpload({
      uploadId: upload.id,
      sessionId,
      filename: file.name,
      sizeBytes: file.size,
    });
    if (!ticket.ok) {
      setStatus(null);
      setError(ticket.error);
      return;
    }
    if (ticket.mode !== "multipart") {
      setStatus(null);
      setError("This upload cannot be resumed.");
      return;
    }

    try {
      await uploadMultipart(file, ticket, {
        onProgress: (fraction) => {
          setStatus(`Resuming ${upload.filename} (${Math.round(fraction * 100)}%)...`);
        },
      });
      setStatus("Registering asset...");
      const completed = await completeMultipartUpload({
        uploadId: ticket.uploadId,
        sessionId,
        key: ticket.key,
        filename: ticket.filename,
        contentType,
        sizeBytes: file.size,
        notes,
      });
      if (!completed.ok) throw new Error(completed.error);
      setStatus(null);
      setResumeTarget(null);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      startTransition(() => router.refresh());
    } catch (resumeError) {
      await abortMultipartUpload({ uploadId: ticket.uploadId, sessionId }).catch(() => undefined);
      setStatus(null);
      setError(
        resumeError instanceof Error
          ? `Resume failed: ${resumeError.message}`
          : "Resume failed.",
      );
    }
  }

  async function cancelPending(upload: PendingUpload) {
    setError(null);
    setStatus(`Cancelling ${upload.filename}...`);
    const result = await abortMultipartUpload({ uploadId: upload.id, sessionId });
    if (!result.ok) {
      setStatus(null);
      setError(result.error ?? "Could not cancel the upload.");
      return;
    }
    setStatus(null);
    startTransition(() => router.refresh());
  }
  async function upload(file: File) {
    setError(null);
    setStatus(`Preparing ${file.name}...`);
    const metadata = await readMediaMetadata(file);
    const contentType = file.type || "application/octet-stream";
    const ticket = await requestUpload({
      sessionId,
      filename: file.name,
      contentType,
      sizeBytes: file.size,
    });
    if (!ticket.ok) {
      setStatus(null);
      setError(ticket.error);
      return;
    }

    let completed;
    try {
      if (ticket.mode === "single") {
        setStatus(`Uploading ${file.name}...`);
        const response = await fetch(ticket.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": contentType },
        });
        if (!response.ok) {
          setStatus(null);
          setError(
            `Upload to R2 failed (${response.status}). Check the bucket CORS policy allows PUT from this origin.`,
          );
          return;
        }
        setStatus("Registering asset...");
        completed = await completeUpload({
          sessionId,
          key: ticket.key,
          filename: ticket.filename,
          contentType,
          sizeBytes: file.size,
          notes,
          ...metadata,
        });
      } else {
        await uploadMultipart(file, ticket, {
          onProgress: (fraction) => {
            setStatus(`Uploading ${file.name} (${Math.round(fraction * 100)}%)...`);
          },
        });
        setStatus("Registering asset...");
        completed = await completeMultipartUpload({
          uploadId: ticket.uploadId,
          sessionId,
          key: ticket.key,
          filename: ticket.filename,
          contentType,
          sizeBytes: file.size,
          notes,
          ...metadata,
        });
      }
    } catch (uploadError) {
      if (ticket.mode === "multipart") {
        await abortMultipartUpload({ uploadId: ticket.uploadId, sessionId }).catch(() => undefined);
      }
      setStatus(null);
      setError(
        uploadError instanceof Error
          ? `Upload failed: ${uploadError.message}. Check the bucket CORS policy.`
          : "Upload failed.",
      );
      return;
    }

    if (!completed.ok) {
      setStatus(null);
      setError(completed.error ?? "Could not register the uploaded file.");
      return;
    }
    setStatus(null);
    setNotes("");
    if (inputRef.current) inputRef.current.value = "";
    startTransition(() => router.refresh());
  }
  return (
    <div className="space-y-3">
      <input
        ref={resumeInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,application/pdf,text/plain,text/markdown"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const target = resumeTarget;
          event.target.value = "";
          if (file && target) void resume(file, target);
        }}
      />
      {pendingUploads.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h3 className="text-sm font-semibold text-amber-900">Interrupted uploads</h3>
          <p className="mt-1 text-xs text-amber-900/80">
            Select the same file again to resume from the parts already uploaded.
          </p>
          <ul className="mt-2 space-y-2">
            {pendingUploads.map((upload) => (
              <li
                key={upload.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{upload.filename}</p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(upload.sizeBytes)} - {upload.partCount} parts
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                    onClick={() => {
                      setResumeTarget(upload);
                      resumeInputRef.current?.click();
                    }}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-700 hover:text-rose-900"
                    onClick={() => void cancelPending(upload)}
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <label htmlFor="media-file" className={labelClass}>
          Recording, screenshot or document
        </label>
        <input
          ref={inputRef}
          id="media-file"
          type="file"
          accept="image/*,video/*,audio/*,application/pdf,text/plain,text/markdown"
          className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-sm`}
          disabled={isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <p className={hintClass}>
          Uploads go directly to your private R2 bucket. Files are never sent to an AI provider
          automatically.
        </p>
      </div>
      <div>
        <label htmlFor="media-notes" className={labelClass}>
          Notes for this asset (optional)
        </label>
        <input
          id="media-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={inputClass}
          placeholder="What does this show? Any timestamp to remember?"
        />
      </div>
      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
      {error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <p className={hintClass}>
        <span className={buttonSecondary}>Choose a file above</span>{" "}
        — images up to 15MB, video up to 512MB.
      </p>
    </div>
  );
}
