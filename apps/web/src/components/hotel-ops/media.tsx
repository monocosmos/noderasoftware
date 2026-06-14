import { ChangeEvent, type CSSProperties, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImageIcon, Maximize2, Pause, Play, PlayCircle, Save, Search, Video, Volume2, VolumeX, X } from "lucide-react";
import type { HotelOpsShellWindow, JobRecord, OperationDocumentFile, PhotoAttachment, PhotoQualityMode, PhotoUploadVariant } from "./types";

export const PHOTO_STANDARD_TARGET_BYTES = 900 * 1024;
export const PHOTO_STANDARD_MAX_SIDE = 1440;
export const PHOTO_STANDARD_MIN_SIDE = 720;
export const PHOTO_HD_TARGET_BYTES = 1_000_000;
export const PHOTO_HD_MAX_SIDE = 2048;
export const PHOTO_HD_MIN_SIDE = 720;
export const PHOTO_STANDARD_QUALITY_STEPS = [0.72, 0.64, 0.56, 0.48, 0.4, 0.34];
export const PHOTO_HD_QUALITY_STEPS = [0.82, 0.76, 0.7, 0.64, 0.58, 0.52, 0.46, 0.4, 0.34, 0.28, 0.22, 0.18];
export const VIDEO_MAX_DURATION_SECONDS = 60;
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
export const VIDEO_TARGET_BYTES = Math.floor(VIDEO_MAX_BYTES * 0.94);
export const VIDEO_MAX_LONG_SIDE = 1280;
export const VIDEO_MAX_SHORT_SIDE = 720;
export const VIDEO_PROCESSING_MESSAGE = "Video sıkıştırılıyor...";
export const VIDEO_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1.4D401E,mp4a.40.2",
  "video/mp4;codecs=avc1.64001F,mp4a.40.2",
  "video/mp4"
];
export const VIDEO_COMPRESSION_ATTEMPTS = [
  { maxLongSide: 1280, maxShortSide: 720, fps: 30, bitrateFactor: 0.86 },
  { maxLongSide: 960, maxShortSide: 540, fps: 24, bitrateFactor: 0.62 },
  { maxLongSide: 854, maxShortSide: 480, fps: 24, bitrateFactor: 0.46 },
  { maxLongSide: 640, maxShortSide: 360, fps: 20, bitrateFactor: 0.32 }
];

export type PhotoCompressionProfile = {
  targetBytes: number;
  maxSide: number;
  minSide: number;
  qualitySteps: number[];
};

export type VideoMetadata = {
  durationSeconds: number;
  width: number;
  height: number;
};

export type VideoCompressionAttempt = {
  maxLongSide: number;
  maxShortSide: number;
  fps: number;
  bitrateFactor: number;
};

export type HTMLVideoElementWithCapture = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

export const photoCompressionProfiles: Record<PhotoQualityMode, PhotoCompressionProfile> = {
  STANDARD: {
    targetBytes: PHOTO_STANDARD_TARGET_BYTES,
    maxSide: PHOTO_STANDARD_MAX_SIDE,
    minSide: PHOTO_STANDARD_MIN_SIDE,
    qualitySteps: PHOTO_STANDARD_QUALITY_STEPS
  },
  HD: {
    targetBytes: PHOTO_HD_TARGET_BYTES,
    maxSide: PHOTO_HD_MAX_SIDE,
    minSide: PHOTO_HD_MIN_SIDE,
    qualitySteps: PHOTO_HD_QUALITY_STEPS
  }
};

export function dataUrlByteSize(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function isVideoAttachment(photo: PhotoAttachment | null | undefined) {
  return photo?.mediaType === "VIDEO" || photo?.mimeType.startsWith("video/") === true;
}

export function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm)$/i.test(file.name);
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

export function compressedPhotoName(name: string) {
  const fallback = name || `foto-${Date.now()}.jpg`;
  return fallback.includes(".") ? fallback.replace(/\.[^.]+$/, ".jpg") : `${fallback}.jpg`;
}

export function compressedVideoName(name: string, mimeType: string) {
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  const fallback = name || `video-${Date.now()}.${extension}`;
  return fallback.includes(".") ? fallback.replace(/\.[^.]+$/, `.${extension}`) : `${fallback}.${extension}`;
}

export function videoMimeTypeForFile(file: File) {
  const mimeType = file.type.trim();
  if (mimeType) return mimeType;
  if (/\.(mp4|m4v)$/i.test(file.name)) return "video/mp4";
  if (/\.webm$/i.test(file.name)) return "video/webm";
  if (/\.mov$/i.test(file.name)) return "video/quicktime";
  return "video/mp4";
}

export function safeMediaMimeType(mimeType: string, fallback = "application/octet-stream") {
  const value = mimeType.trim().toLowerCase();
  if (!value) return fallback;
  if (value.startsWith("video/mp4")) return "video/mp4";
  if (value.startsWith("video/webm")) return "video/webm";
  if (value.startsWith("video/quicktime")) return "video/quicktime";
  if (value.startsWith("image/jpeg") || value.startsWith("image/jpg")) return "image/jpeg";
  if (value.startsWith("image/png")) return "image/png";
  if (value.startsWith("image/webp")) return "image/webp";
  return value.split(";")[0] || fallback;
}

export function dataUrlBase64Payload(dataUrl: string) {
  const value = dataUrl.trim();
  const marker = ";base64,";
  const markerIndex = value.toLowerCase().lastIndexOf(marker);
  if (markerIndex >= 0) return value.slice(markerIndex + marker.length);
  const commaIndex = value.indexOf(",");
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : "";
}

export function normalizeDataUrl(dataUrl: string, mimeType: string) {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  const payload = dataUrlBase64Payload(dataUrl);
  if (!payload) return dataUrl;
  return `data:${safeMediaMimeType(mimeType)};base64,${payload}`;
}

export function fileToPhotoVariant(file: File): Promise<PhotoUploadVariant> {
  return new Promise((resolve, reject) => {
    const mimeType = safeMediaMimeType(file.type || "image/jpeg", "image/jpeg");
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name || `foto-${Date.now()}.jpg`,
      mimeType,
      size: file.size,
      dataUrl: normalizeDataUrl(String(reader.result ?? ""), mimeType),
      mediaType: "PHOTO"
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_DECODE_FAILED"));
    };
    image.src = objectUrl;
  });
}

export function canvasForImage(image: HTMLImageElement, maxSide: number) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const ratio = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("CANVAS_CONTEXT_FAILED");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

export async function compressImage(file: File, mode: PhotoQualityMode = "STANDARD"): Promise<PhotoUploadVariant> {
  const profile = photoCompressionProfiles[mode];

  try {
    const image = await loadImage(file);
    const sourceLongSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
    let maxSide = Math.min(profile.maxSide, sourceLongSide);
    let best: { dataUrl: string; size: number } | null = null;
    let shouldContinue = true;

    while (shouldContinue) {
      const canvas = canvasForImage(image, maxSide);

      for (const quality of profile.qualitySteps) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const size = dataUrlByteSize(dataUrl);
        if (!best || size < best.size) {
          best = { dataUrl, size };
        }
        if (size <= profile.targetBytes) {
          return {
            name: compressedPhotoName(file.name),
            mimeType: "image/jpeg",
            size,
            dataUrl,
            mediaType: "PHOTO"
          };
        }
      }

      if (Math.max(canvas.width, canvas.height) <= profile.minSide) break;
      maxSide = Math.max(profile.minSide, Math.round(maxSide * 0.82));
      shouldContinue = maxSide >= 1;
    }

    if (best) {
      return {
        name: compressedPhotoName(file.name),
        mimeType: "image/jpeg",
        size: best.size,
        dataUrl: best.dataUrl,
        mediaType: "PHOTO"
      };
    }
  } catch {
    return fileToPhotoVariant(file);
  }

  return fileToPhotoVariant(file);
}

export function supportedVideoMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  const video = document.createElement("video");
  return VIDEO_MIME_CANDIDATES.find((mimeType) => (
    MediaRecorder.isTypeSupported(mimeType) && video.canPlayType(mimeType) !== ""
  )) ?? "";
}

export function loadVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.preload = "metadata";
    video.playsInline = true;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const durationSeconds = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !width || !height) {
        reject(new Error("VIDEO_METADATA_FAILED"));
        return;
      }
      resolve({ durationSeconds, width, height });
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("VIDEO_METADATA_FAILED"));
    };
    video.src = objectUrl;
  });
}

export function outputVideoDimensions(metadata: VideoMetadata, attempt: VideoCompressionAttempt) {
  const sourceLongSide = Math.max(metadata.width, metadata.height);
  const sourceShortSide = Math.min(metadata.width, metadata.height);
  const ratio = Math.min(
    1,
    attempt.maxLongSide / sourceLongSide,
    attempt.maxShortSide / sourceShortSide,
    VIDEO_MAX_LONG_SIDE / sourceLongSide,
    VIDEO_MAX_SHORT_SIDE / sourceShortSide
  );
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  return {
    width: even(metadata.width * ratio),
    height: even(metadata.height * ratio)
  };
}

export function videoPosterFromFile(file: File, metadata: VideoMetadata): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    const posterDimensions = outputVideoDimensions(metadata, {
      maxLongSide: 640,
      maxShortSide: 360,
      fps: 1,
      bitrateFactor: 1
    });
    const canvas = document.createElement("canvas");
    canvas.width = posterDimensions.width;
    canvas.height = posterDimensions.height;
    const context = canvas.getContext("2d", { alpha: false });
    let settled = false;
    let timeout = 0;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      callback();
    };

    const capture = () => {
      if (!context) {
        finish(() => reject(new Error("VIDEO_POSTER_FAILED")));
        return;
      }
      try {
        context.fillStyle = "#020617";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        finish(() => resolve(dataUrl));
      } catch {
        finish(() => reject(new Error("VIDEO_POSTER_FAILED")));
      }
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadedmetadata = () => {
      const targetTime = Math.min(1, Math.max(0, metadata.durationSeconds - 0.1));
      if (targetTime > 0.05) {
        video.currentTime = targetTime;
      } else {
        capture();
      }
    };
    video.onseeked = capture;
    video.onloadeddata = () => {
      if (video.currentTime <= 0.05 && metadata.durationSeconds <= 0.2) capture();
    };
    video.onerror = () => finish(() => reject(new Error("VIDEO_POSTER_FAILED")));
    timeout = window.setTimeout(() => finish(() => reject(new Error("VIDEO_POSTER_FAILED"))), 5000);
    video.src = objectUrl;
    video.load();
  });
}

export function blobToDataUrl(blob: Blob, mimeType = blob.type): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(normalizeDataUrl(String(reader.result ?? ""), mimeType || blob.type));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function captureStreamFromVideo(video: HTMLVideoElement) {
  const captureVideo = video as HTMLVideoElementWithCapture;
  return captureVideo.captureStream?.() ?? captureVideo.mozCaptureStream?.() ?? null;
}

async function playVideoForCompression(video: HTMLVideoElement) {
  try {
    await video.play();
  } catch {
    video.muted = true;
    await video.play();
  }
}

async function recordCompressedVideo(file: File, metadata: VideoMetadata, attempt: VideoCompressionAttempt, mimeType: string) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  const dimensions = outputVideoDimensions(metadata, attempt);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("VIDEO_COMPRESSION_UNSUPPORTED");
  }

  const canvasStream = canvas.captureStream?.(attempt.fps);
  if (!canvasStream) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("VIDEO_COMPRESSION_UNSUPPORTED");
  }

  video.preload = "auto";
  video.playsInline = true;
  video.volume = 0;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("VIDEO_METADATA_FAILED"));
    video.src = objectUrl;
    video.load();
  });

  const sourceStream = captureStreamFromVideo(video);
  const outputStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(sourceStream?.getAudioTracks() ?? [])
  ]);
  const durationSeconds = Math.max(1, metadata.durationSeconds);
  const videoBitsPerSecond = Math.max(
    280_000,
    Math.min(4_000_000, Math.floor(((VIDEO_TARGET_BYTES * 8) / durationSeconds) * attempt.bitrateFactor))
  );
  const chunks: Blob[] = [];
  let animationFrame = 0;

  const drawFrame = () => {
    if (!video.paused && !video.ended) {
      context.fillStyle = "#000000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    animationFrame = window.requestAnimationFrame(drawFrame);
  };

  try {
    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond
    };
    if (mimeType) recorderOptions.mimeType = mimeType;
    const recorder = new MediaRecorder(outputStream, recorderOptions);
    const recorded = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("VIDEO_COMPRESSION_FAILED"));
      recorder.onstop = () => {
        const outputType = recorder.mimeType || mimeType || chunks[0]?.type || "video/webm";
        resolve(new Blob(chunks, { type: outputType }));
      };
      video.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };
    });

    recorder.start(1000);
    await playVideoForCompression(video);
    drawFrame();
    const timeout = window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, Math.ceil((metadata.durationSeconds + 4) * 1000));
    const blob = await recorded;
    window.clearTimeout(timeout);
    return { blob, width: dimensions.width, height: dimensions.height };
  } finally {
    window.cancelAnimationFrame(animationFrame);
    outputStream.getTracks().forEach((track) => track.stop());
    sourceStream?.getTracks().forEach((track) => track.stop());
    URL.revokeObjectURL(objectUrl);
  }
}

async function videoFileToVariant(file: File, metadata?: VideoMetadata, posterDataUrl?: string): Promise<PhotoUploadVariant> {
  const videoMetadata = metadata ?? await loadVideoMetadata(file);
  if (videoMetadata.durationSeconds > VIDEO_MAX_DURATION_SECONDS) {
    throw new Error("VIDEO_DURATION_TOO_LONG");
  }
  if (file.size > VIDEO_MAX_BYTES) {
    throw new Error("VIDEO_TOO_LARGE");
  }

  const mimeType = safeMediaMimeType(videoMimeTypeForFile(file), "video/mp4");
  if (!mimeType.toLowerCase().startsWith("video/mp4")) {
    throw new Error("VIDEO_MP4_REQUIRED");
  }

  const dataUrl = await blobToDataUrl(file, mimeType);
  const name = file.name?.trim() || `hotelops-video-${Date.now()}.mp4`;
  const videoPosterDataUrl = posterDataUrl ?? await videoPosterFromFile(file, videoMetadata).catch(() => "");

  return {
    name: compressedVideoName(name, mimeType),
    mimeType,
    size: file.size,
    dataUrl,
    mediaType: "VIDEO",
    durationSeconds: videoMetadata.durationSeconds,
    width: videoMetadata.width,
    height: videoMetadata.height,
    compressed: false,
    videoPosterDataUrl: videoPosterDataUrl || undefined,
    originalDataUrl: dataUrl,
    originalName: name,
    originalMimeType: mimeType
  };
}

async function compressVideo(file: File): Promise<PhotoUploadVariant> {
  const metadata = await loadVideoMetadata(file);
  if (metadata.durationSeconds > VIDEO_MAX_DURATION_SECONDS) {
    throw new Error("VIDEO_DURATION_TOO_LONG");
  }
  const videoPosterDataUrl = await videoPosterFromFile(file, metadata).catch(() => "");
  const originalMimeType = safeMediaMimeType(videoMimeTypeForFile(file), "video/mp4");
  const originalDataUrlPromise = blobToDataUrl(file, originalMimeType);

  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    return videoFileToVariant(file, metadata, videoPosterDataUrl);
  }

  const mimeType = supportedVideoMimeType();
  if (!mimeType) {
    return videoFileToVariant(file, metadata, videoPosterDataUrl);
  }

  let lastError: unknown = null;
  for (const attempt of VIDEO_COMPRESSION_ATTEMPTS) {
    try {
      const output = await recordCompressedVideo(file, metadata, attempt, mimeType);
      if (output.blob.size > 0 && output.blob.size <= VIDEO_MAX_BYTES) {
        const outputType = safeMediaMimeType(output.blob.type || mimeType, "video/mp4");
        const outputName = compressedVideoName(file.name, outputType);
        const outputFile = new File([output.blob], outputName, { type: outputType });
        await loadVideoMetadata(outputFile);
        const dataUrl = await blobToDataUrl(output.blob, outputType);
        const originalDataUrl = await originalDataUrlPromise;
        return {
          name: outputName,
          mimeType: outputType,
          size: output.blob.size,
          dataUrl,
          mediaType: "VIDEO",
          durationSeconds: metadata.durationSeconds,
          width: output.width,
          height: output.height,
          compressed: true,
          videoPosterDataUrl: videoPosterDataUrl || undefined,
          originalDataUrl,
          originalName: file.name?.trim() || outputName,
          originalMimeType
        };
      }
      lastError = new Error("VIDEO_TOO_LARGE");
    } catch (error) {
      lastError = error;
    }
  }

  try {
    return await videoFileToVariant(file, metadata, videoPosterDataUrl);
  } catch {
    // Keep the compression-specific failure when original upload is not usable.
  }

  throw lastError instanceof Error ? lastError : new Error("VIDEO_COMPRESSION_FAILED");
}

export function mediaUploadErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "VIDEO_DURATION_TOO_LONG") return "Video en fazla 1 dakika olabilir.";
  if (code === "VIDEO_TOO_LARGE") return "Video 25 MB altına sıkıştırılamadı.";
  if (code === "VIDEO_METADATA_FAILED") return "Video okunamadı.";
  if (code === "VIDEO_MP4_REQUIRED") return "Video MP4 formatında olmalıdır.";
  if (code === "VIDEO_COMPRESSION_UNSUPPORTED") return "Bu cihazda uyumlu MP4 video sıkıştırma desteklenmiyor.";
  return "Medya hazırlanamadı.";
}

export type PhotoSelection = {
  photo: PhotoAttachment;
  sourceFile: File;
};

export function newPhotoClientId() {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function photoFromVariant(variant: PhotoUploadVariant, qualityMode: PhotoQualityMode, clientId = newPhotoClientId()): PhotoAttachment {
  return {
    ...variant,
    clientId,
    qualityMode,
    standardVariant: qualityMode === "STANDARD" ? variant : undefined,
    hdVariant: qualityMode === "HD" ? variant : undefined
  };
}

export function applyPhotoVariant(photo: PhotoAttachment, variant: PhotoUploadVariant, qualityMode: PhotoQualityMode): PhotoAttachment {
  return {
    ...photo,
    ...variant,
    qualityMode,
    standardVariant: qualityMode === "STANDARD" ? variant : photo.standardVariant,
    hdVariant: qualityMode === "HD" ? variant : photo.hdVariant,
    hdPreparing: false
  };
}

export function currentPhotoVariant(photo: PhotoAttachment): PhotoUploadVariant {
  return {
    name: photo.name,
    mimeType: photo.mimeType,
    size: photo.size,
    dataUrl: photo.dataUrl,
    mediaType: photo.mediaType,
    durationSeconds: photo.durationSeconds,
    width: photo.width,
    height: photo.height,
    compressed: photo.compressed,
    videoPosterDataUrl: photo.videoPosterDataUrl,
    originalDataUrl: photo.originalDataUrl,
    originalName: photo.originalName,
    originalMimeType: photo.originalMimeType
  };
}

export async function filesToPhotoSelections(files: FileList | null) {
  const selected = Array.from(files ?? [])
    .filter((file) => isImageFile(file) || isVideoFile(file))
    .slice(0, 6);
  const selections: PhotoSelection[] = [];

  for (const file of selected) {
    if (isVideoFile(file)) {
      const videoVariant = await compressVideo(file);
      selections.push({ photo: photoFromVariant(videoVariant, "STANDARD"), sourceFile: file });
    } else {
      const standardVariant = await compressImage(file, "STANDARD");
      selections.push({ photo: photoFromVariant(standardVariant, "STANDARD"), sourceFile: file });
    }
  }

  return selections;
}

export function photoUploadPayload(photo: PhotoAttachment): PhotoAttachment {
  return {
    name: photo.name,
    mimeType: photo.mimeType,
    size: photo.size,
    dataUrl: photo.dataUrl,
    phase: photo.phase ?? "GENERAL",
    mediaType: isVideoAttachment(photo) ? "VIDEO" : "PHOTO",
    durationSeconds: photo.durationSeconds,
    width: photo.width,
    height: photo.height,
    compressed: photo.compressed
  };
}

export function photosUploadPayload(photos: PhotoAttachment[] = []) {
  return photos.map(photoUploadPayload);
}

export function hasPendingPhotoProcessing(photos: PhotoAttachment[] = []) {
  return photos.some((photo) => photo.hdPreparing);
}

export const operationDocumentAccept = ".pdf,.xls,.xlsx,.doc,.docx,.ppt,.pptx";
export const operationDocumentExtensions = new Set(["pdf", "xls", "xlsx", "doc", "docx", "ppt", "pptx"]);

export function isAllowedOperationDocumentFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  return operationDocumentExtensions.has(extension);
}

export function fileSizeLabel(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export function photoDownloadName(photo: PhotoAttachment) {
  if (isVideoAttachment(photo)) {
    const fallback = `hotelops-video-${Date.now()}.webm`;
    const name = (photo.originalName || photo.name || fallback).trim();
    if (/\.(mp4|webm|mov|m4v)$/i.test(name)) return name;
    const mimeType = photo.originalMimeType || photo.mimeType;
    const extension = mimeType.includes("mp4") ? "mp4" : mimeType.includes("quicktime") ? "mov" : "webm";
    return `${name || "hotelops-video"}.${extension}`;
  }

  const fallback = `hotelops-foto-${Date.now()}.jpg`;
  const name = (photo.name || fallback).trim();
  if (/\.(jpe?g|png|webp|heic|heif)$/i.test(name)) return name;
  const extension = photo.mimeType === "image/png" ? "png" : photo.mimeType === "image/webp" ? "webp" : "jpg";
  return `${name || "hotelops-foto"}.${extension}`;
}

export function videoPlaybackSrc(photo: PhotoAttachment) {
  const source = photo.originalDataUrl || photo.dataUrl;
  return source ? normalizeDataUrl(source, photo.originalMimeType || photo.mimeType || "video/mp4") : "";
}

export function mediaSaveDataUrl(photo: PhotoAttachment) {
  if (isVideoAttachment(photo)) return videoPlaybackSrc(photo);
  return photo.dataUrl ? normalizeDataUrl(photo.dataUrl, photo.mimeType || "image/jpeg") : "";
}

export function mediaSaveMimeType(photo: PhotoAttachment) {
  return safeMediaMimeType(
    isVideoAttachment(photo) ? (photo.originalMimeType || photo.mimeType || "video/mp4") : (photo.mimeType || "image/jpeg"),
    isVideoAttachment(photo) ? "video/mp4" : "image/jpeg"
  );
}

export function mediaNeedsPayload(photo: PhotoAttachment) {
  return Boolean(photo.hasDataUrl && !mediaSaveDataUrl(photo));
}

export function jobNeedsMediaPayload(job: JobRecord | undefined) {
  return Boolean(job?.photos?.some(mediaNeedsPayload));
}

export function stripPhotoStoragePayload(photo: PhotoAttachment): PhotoAttachment {
  if (!photo.dataUrl && !photo.originalDataUrl && !photo.standardVariant && !photo.hdVariant) return photo;
  return {
    ...photo,
    dataUrl: "",
    originalDataUrl: undefined,
    standardVariant: undefined,
    hdVariant: undefined
  };
}

export function stripJobStoragePayload(job: JobRecord): JobRecord {
  return job.photos?.length
    ? { ...job, photos: job.photos.map(stripPhotoStoragePayload) }
    : job;
}

export function MediaPreview({ photo, width, height, className }: { photo: PhotoAttachment; width: number; height: number; className?: string }) {
  if (isVideoAttachment(photo)) {
    const src = videoPlaybackSrc(photo);
    return (
      <span className={["video-preview-frame", className].filter(Boolean).join(" ")}>
        {src ? (
          <video
            className="video-preview-media"
            src={src}
            poster={photo.videoPosterDataUrl}
            width={width}
            height={height}
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <span className="media-preview-placeholder"><Video size={30} /> Video</span>
        )}
        <span className="video-preview-play" aria-hidden="true">
          <PlayCircle size={38} />
        </span>
      </span>
    );
  }

  if (!photo.dataUrl) {
    return (
      <span className={["video-preview-frame", className].filter(Boolean).join(" ")}>
        <span className="media-preview-placeholder"><ImageIcon size={30} /> Fotoğraf</span>
      </span>
    );
  }

  return <Image className={className} src={photo.dataUrl} alt={photo.name} width={width} height={height} unoptimized />;
}

export function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function LightboxVideoPlayer({ src, poster, title }: { src: string; poster?: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
  }, [src]);

  const updateMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    setIsMuted(video.muted);
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      void video.play().catch(() => setIsPlaying(false));
      return;
    }
    video.pause();
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const nextTime = Number(event.currentTarget.value);
    setCurrentTime(nextTime);
    if (video && Number.isFinite(nextTime)) video.currentTime = nextTime;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const element = frameRef.current as FullscreenTarget | null;
    if (!element) return;
    const fullscreenDocument = document as FullscreenDocument;
    const fullscreenElement = document.fullscreenElement || fullscreenDocument.webkitFullscreenElement;
    if (fullscreenElement) {
      void (document.exitFullscreen?.() || fullscreenDocument.webkitExitFullscreen?.());
      return;
    }
    void (element.requestFullscreen?.() || element.webkitRequestFullscreen?.());
  };

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const progressStyle = { "--video-progress": `${progress}%` } as CSSProperties;

  return (
    <div className="lightbox-video-player" ref={frameRef}>
      <video
        ref={videoRef}
        className="photo-lightbox-video"
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        onClick={togglePlayback}
        onLoadedMetadata={updateMetadata}
        onDurationChange={updateMetadata}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        type="button"
        className={`lightbox-video-center ${isPlaying ? "is-playing" : ""}`}
        onClick={togglePlayback}
        aria-label={isPlaying ? "Duraklat" : "Oynat"}
      >
        {isPlaying ? <Pause size={30} /> : <Play size={32} fill="currentColor" />}
      </button>
      <div className="lightbox-video-controls" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="lightbox-video-control" onClick={togglePlayback} aria-label={isPlaying ? "Duraklat" : "Oynat"}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
        </button>
        <div className="lightbox-video-timeline">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.05"
            value={Math.min(currentTime, duration || currentTime)}
            onChange={handleSeek}
            style={progressStyle}
            aria-label={`${title} video süresi`}
          />
          <span>{formatVideoTime(currentTime)} / {formatVideoTime(duration)}</span>
        </div>
        <button type="button" className="lightbox-video-control" onClick={toggleMute} aria-label={isMuted ? "Sesi aç" : "Sesi kapat"}>
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button type="button" className="lightbox-video-control" onClick={toggleFullscreen} aria-label="Tam ekran">
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );
}

export function PhotoLightbox({ photo, onClose }: { photo: PhotoAttachment | null; onClose: () => void }) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "failed" | "unsupported">("idle");

  useEffect(() => {
    if (!photo) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [photo, onClose]);

  useEffect(() => {
    setSaveStatus("idle");
  }, [photo?.dataUrl, photo?.originalDataUrl]);

  const handleSave = () => {
    if (!photo) return;
    const fileName = photoDownloadName(photo);
    const shell = (window as HotelOpsShellWindow).HotelOpsAndroidShell;
    const dataUrl = mediaSaveDataUrl(photo);
    const mimeType = mediaSaveMimeType(photo);
    const isAndroidShell = shell?.runtime?.() === "android";

    if (!dataUrl) {
      setSaveStatus("failed");
      return;
    }

    if (isVideoAttachment(photo) && isAndroidShell && !shell?.saveMediaToGallery) {
      setSaveStatus("unsupported");
      return;
    }

    if (shell?.saveMediaToGallery) {
      const saved = shell.saveMediaToGallery(dataUrl, fileName, mimeType);
      setSaveStatus(saved ? "saved" : "failed");
      return;
    }

    if (!isVideoAttachment(photo) && shell?.saveImageToGallery) {
      const saved = shell.saveImageToGallery(dataUrl, fileName);
      setSaveStatus(saved ? "saved" : "failed");
      return;
    }

    try {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSaveStatus("saved");
    } catch {
      setSaveStatus("failed");
    }
  };

  if (!photo) return null;
  const lightboxSrc = mediaSaveDataUrl(photo);
  const isVideo = isVideoAttachment(photo);
  const fallbackTitle = isVideo ? "Video" : "Fotoğraf";
  const mediaTitle = photo.name || fallbackTitle;

  return (
    <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={isVideo ? "Video önizleme" : "Fotoğraf önizleme"} onClick={onClose}>
      <button type="button" className="photo-lightbox-close" onClick={onClose} aria-label={isVideo ? "Videoyu kapat" : "Fotoğrafı kapat"}>
        <X size={20} />
      </button>
      <div className={`photo-lightbox-frame ${isVideo ? "is-video" : ""}`} onClick={(event) => event.stopPropagation()}>
        {isVideo && lightboxSrc ? (
          <LightboxVideoPlayer src={lightboxSrc} poster={photo.videoPosterDataUrl} title={mediaTitle} />
        ) : isVideo ? (
          <div className="photo-lightbox-placeholder"><Video size={34} /> Video yükleniyor...</div>
        ) : lightboxSrc ? (
          <Image src={lightboxSrc} alt={mediaTitle} width={1280} height={960} unoptimized />
        ) : (
          <div className="photo-lightbox-placeholder"><ImageIcon size={34} /> Medya yükleniyor...</div>
        )}
        <div className="photo-lightbox-footer">
          <div className="photo-lightbox-caption">
            <span>{mediaTitle}</span>
            <span>{fileSizeLabel(photo.size)}</span>
          </div>
          <div className="photo-lightbox-actions">
            {saveStatus !== "idle" ? (
              <span className={`photo-save-status ${saveStatus}`}>
                {saveStatus === "saved" ? "Kaydedildi" : saveStatus === "unsupported" ? "Uygulamayı güncelleyin" : "Kaydedilemedi"}
              </span>
            ) : null}
            <button type="button" className="photo-lightbox-save" onClick={handleSave}>
              <Save size={16} /> Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function fileToOperationDocument(file: File): Promise<OperationDocumentFile> {
  return new Promise((resolve, reject) => {
    if (!isAllowedOperationDocumentFile(file)) {
      reject(new Error("UNSUPPORTED_DOCUMENT_TYPE"));
      return;
    }
    if (file.size > 8_000_000) {
      reject(new Error("DOCUMENT_TOO_LARGE"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: String(reader.result ?? "")
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PhotoPicker({
  phase = "GENERAL",
  photos,
  setPhotos
}: {
  phase?: "GENERAL" | "BEFORE" | "AFTER";
  photos: PhotoAttachment[];
  setPhotos: (updater: (photos: PhotoAttachment[]) => PhotoAttachment[]) => void;
}) {
  const [previewPhoto, setPreviewPhoto] = useState<PhotoAttachment | null>(null);
  const [processingMessage, setProcessingMessage] = useState("");
  const sourceFilesRef = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    const activeClientIds = new Set(photos.map((photo) => photo.clientId).filter(Boolean) as string[]);
    for (const clientId of Array.from(sourceFilesRef.current.keys())) {
      if (!activeClientIds.has(clientId)) {
        sourceFilesRef.current.delete(clientId);
      }
    }
  }, [photos]);

  const photoKey = (photo: PhotoAttachment, index: number) => photo.clientId ?? photo.id ?? `${photo.name}-${index}`;

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    setProcessingMessage("");
    const hasVideo = Array.from(event.target.files ?? []).some(isVideoFile);
    if (hasVideo) setProcessingMessage(VIDEO_PROCESSING_MESSAGE);
    try {
      const nextPhotos = (await filesToPhotoSelections(event.target.files)).map(({ photo, sourceFile }) => {
        const nextPhoto = { ...photo, phase };
        if (nextPhoto.clientId && !isVideoAttachment(nextPhoto)) {
          sourceFilesRef.current.set(nextPhoto.clientId, sourceFile);
        }
        return nextPhoto;
      });
      if (nextPhotos.length) {
        setPhotos((current) => [...current, ...nextPhotos].slice(0, 6));
      }
    } catch (error) {
      setProcessingMessage(mediaUploadErrorMessage(error));
      return;
    } finally {
      event.target.value = "";
      if (hasVideo) {
        window.setTimeout(() => setProcessingMessage((current) => current === VIDEO_PROCESSING_MESSAGE ? "" : current), 1500);
      }
    }
  };

  const handleReplaceFile = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    setProcessingMessage("");
    const hasVideo = Array.from(event.target.files ?? []).some(isVideoFile);
    if (hasVideo) setProcessingMessage(VIDEO_PROCESSING_MESSAGE);
    try {
      const [selection] = await filesToPhotoSelections(event.target.files);
      if (selection) {
        const nextPhoto = { ...selection.photo, phase };
        if (nextPhoto.clientId && !isVideoAttachment(nextPhoto)) {
          sourceFilesRef.current.set(nextPhoto.clientId, selection.sourceFile);
        }
        setPhotos((current) => {
          const previousPhoto = current[index];
          if (previousPhoto?.clientId) sourceFilesRef.current.delete(previousPhoto.clientId);
          return current.map((photo, itemIndex) => (itemIndex === index ? nextPhoto : photo));
        });
      }
    } catch (error) {
      setProcessingMessage(mediaUploadErrorMessage(error));
      return;
    } finally {
      event.target.value = "";
      if (hasVideo) {
        window.setTimeout(() => setProcessingMessage((current) => current === VIDEO_PROCESSING_MESSAGE ? "" : current), 1500);
      }
    }
  };

  const handleHdToggle = async (photo: PhotoAttachment, checked: boolean) => {
    const clientId = photo.clientId;
    if (!clientId) return;

    if (!checked) {
      const standardVariant = photo.standardVariant ?? currentPhotoVariant(photo);
      setPhotos((current) => current.map((item) => (
        item.clientId === clientId ? applyPhotoVariant(item, standardVariant, "STANDARD") : item
      )));
      return;
    }

    if (photo.hdVariant) {
      setPhotos((current) => current.map((item) => (
        item.clientId === clientId ? applyPhotoVariant(item, photo.hdVariant!, "HD") : item
      )));
      return;
    }

    const sourceFile = sourceFilesRef.current.get(clientId);
    if (!sourceFile) return;

    setPhotos((current) => current.map((item) => (
      item.clientId === clientId ? { ...item, qualityMode: "HD", hdPreparing: true } : item
    )));

    try {
      const hdVariant = await compressImage(sourceFile, "HD");
      setPhotos((current) => current.map((item) => {
        if (item.clientId !== clientId) return item;
        if (item.qualityMode !== "HD" && !item.hdPreparing) {
          return { ...item, hdVariant, hdPreparing: false };
        }
        return applyPhotoVariant(item, hdVariant, "HD");
      }));
    } catch {
      setPhotos((current) => current.map((item) => (
        item.clientId === clientId ? { ...item, qualityMode: "STANDARD", hdPreparing: false } : item
      )));
    }
  };

  return (
    <div className="photo-uploader">
      <div className="photo-actions">
        <label className="btn btn-secondary btn-sm photo-input-trigger" data-hotelops-media-picker="camera">
          <Camera size={14} /> Kamera
          <input className="native-photo-input" type="file" accept="image/*" capture="environment" data-hotelops-media-picker="camera" onChange={handleFiles} />
        </label>
        <label className="btn btn-secondary btn-sm photo-input-trigger" data-hotelops-media-picker="video">
          <Video size={14} /> Video
          <input className="native-photo-input" type="file" accept="video/*" capture="environment" data-hotelops-media-picker="video" onChange={handleFiles} />
        </label>
        <label className="btn btn-ghost btn-sm photo-input-trigger" data-hotelops-media-picker="gallery">
          <ImageIcon size={14} /> Galeri / Dosya
          <input className="native-photo-input" type="file" accept="image/*,video/*" multiple data-hotelops-media-picker="gallery" onChange={handleFiles} />
        </label>
      </div>
      {processingMessage ? <div className="media-processing-status">{processingMessage}</div> : null}
      {photos.length > 0 && (
        <div className="photo-preview-grid">
          {photos.map((photo, index) => (
            <div className="photo-preview-item" key={photoKey(photo, index)}>
              <div className="photo-preview">
                <MediaPreview photo={photo} width={180} height={120} />
              <button type="button" className="photo-open" onClick={() => setPreviewPhoto(photo)} aria-label={isVideoAttachment(photo) ? "Videoyu buyut" : "Fotoğrafı büyüt"}>
                <Search size={12} />
              </button>
              <label className="photo-change">
                {isVideoAttachment(photo) ? <Video size={12} /> : <ImageIcon size={12} />}
                <input className="native-photo-input" type="file" accept="image/*,video/*" onChange={(event) => handleReplaceFile(index, event)} />
              </label>
                <button type="button" className="photo-remove" onClick={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <X size={12} />
                </button>
              </div>
              {isVideoAttachment(photo) ? (
                <div className="photo-hd-toggle media-upload-meta">
                  <span>Video</span>
                  <span className="photo-quality-size">{fileSizeLabel(photo.size)}</span>
                </div>
              ) : <label className="photo-hd-toggle">
                <input
                  type="checkbox"
                  checked={photo.qualityMode === "HD"}
                  disabled={photo.hdPreparing}
                  onChange={(event) => void handleHdToggle(photo, event.target.checked)}
                />
                <span>HD kalitede gönder</span>
                <span className="photo-quality-size">{photo.hdPreparing ? "HD hazırlanıyor" : fileSizeLabel(photo.size)}</span>
              </label>}
            </div>
          ))}
        </div>
      )}
      <PhotoLightbox photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
    </div>
  );
}
