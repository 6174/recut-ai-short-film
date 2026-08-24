/**
 * [INPUT]: 依赖媒体内容 URL 与浏览器原生 iframe 媒体文档
 * [OUTPUT]: 对外提供 VideoFrame；缩略图以 srcDoc iframe 展示静音循环视频，详情以 iframe 打开原始媒体 URL
 * [POS]: ai-short-film UI 的视频画面原子；资源卡、引用缩略图和资源详情共用，隔离媒体解码与卡片交互
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */

import { getRecutLocale } from "./recut-sdk";

type VideoFrameProps = {
  alt: string;
  className?: string;
  controls?: boolean;
  src: string;
  videoClassName?: string;
};

/** ---------- Video frame ---------- */
export function VideoFrame({ alt, className, controls = false, src, videoClassName }: VideoFrameProps) {
  if (!controls) {
    return <div className={classes("relative isolate aspect-video w-full overflow-hidden bg-muted", className)}><iframe allow="autoplay" className={classes("pointer-events-none block size-full border-0", videoClassName)} srcDoc={videoDocument(src, alt)} tabIndex={-1} title={alt} /></div>;
  }

  return <div className={classes("aspect-video isolate overflow-hidden bg-black", className)}><iframe allow="autoplay; fullscreen; picture-in-picture" className={classes("block size-full border-0", videoClassName)} src={src} title={alt} /></div>;
}

function classes(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function videoDocument(src: string, alt: string) {
  const lang = getRecutLocale() === "en" ? "en" : "zh-CN";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>html,body,video{height:100%;width:100%;margin:0;background:#000}video{display:block;object-fit:cover}</style></head><body><video aria-label="${escapeAttribute(alt)}" autoplay loop muted playsinline preload="metadata" src="${escapeAttribute(src)}"></video></body></html>`;
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
