/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef } from "react";
import { Upload, Camera, X } from "lucide-react";

interface ImageUploaderProps {
  onImageSelected: (imageUri: string | null, file?: File | null) => void;
}

export function ImageUploader({ onImageSelected }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      onImageSelected(url, file);
    }
  };

  const handleClear = () => {
    setPreview(null);
    onImageSelected(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (preview) {
    return (
      <div className="relative w-full aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden bg-black/5 border border-border shadow-sm">
        <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        <button 
          onClick={handleClear}
          className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
          title="Remove image"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="w-full aspect-square md:aspect-[4/3] rounded-2xl border-2 border-dashed border-sage/50 hover:border-earth bg-surface/50 hover:bg-surface flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer group"
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
      
      <div className="w-16 h-16 rounded-full bg-sage-light/50 flex items-center justify-center text-sage group-hover:text-earth group-hover:scale-110 transition-all duration-300">
        <Camera className="w-8 h-8" />
      </div>
      
      <div className="text-center px-4">
        <p className="font-medium text-forest text-lg mb-1">
          Take a photo or upload
        </p>
        <p className="text-sm text-sage">
          Show us what you found in nature
        </p>
      </div>
      
      <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-sm font-medium border border-border shadow-sm text-forest group-hover:border-earth/50">
        <Upload className="w-4 h-4 text-earth" />
        Select File
      </div>
    </div>
  );
}
