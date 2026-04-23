"use client";

import { useCallback, useRef, useState } from "react";

const MAX_BYTES = 2 * 1024 * 1024;

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Please choose an image file (JPEG, PNG, WebP, etc.)."));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error("Image must be under 2 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

export default function ProductImageUploadField({ value, onChange, onError }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const applyFile = useCallback(
    async (file) => {
      try {
        const dataUrl = await readImageFile(file);
        onChange(dataUrl);
      } catch (e) {
        if (onError) onError(e.message || "Could not use this image.");
      }
    },
    [onChange, onError]
  );

  const onInputChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) applyFile(file);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) applyFile(file);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-600">Product image</p>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed px-4 py-5 transition-colors ${
          dragging ? "border-teal-500 bg-teal-50" : "border-slate-300 bg-slate-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Choose product image from your device"
          onChange={onInputChange}
        />

        {value ? (
          <div className="flex flex-col items-center gap-3">
            <img src={value} alt="" className="max-h-28 w-auto rounded-lg object-contain shadow-sm" />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={openPicker}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Replace image
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-slate-700">Drag an image here, or browse from your device</p>
            <p className="text-xs text-slate-500">Works on phone — gallery or camera. Max 2 MB.</p>
            <button
              type="button"
              onClick={openPicker}
              className="rounded-full border border-teal-600 bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500"
            >
              Browse files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
