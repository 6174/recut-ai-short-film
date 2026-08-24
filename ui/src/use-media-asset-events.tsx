/**
 * [INPUT]: 依赖浏览器 EventSource 与 Recut `/v1/media/events` 的资产快照/增量事件契约
 * [OUTPUT]: 对外提供 MediaAssetEventsProvider、useMediaAssetEvents 与 AssetState；维护 iframe 内唯一的 Asset 生命周期缓存，并为生成中的素材补充本地状态校验
 * [POS]: ai-short-film UI 的媒体状态边界；资源卡、资源详情和引用缩略图共享一条 Recut SSE；SSE 重连滞后时仅校验仍在生成的素材，不查询 Provider
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type AssetState = {
  id: string;
  kind: "image" | "video" | "audio";
  status: "queued" | "running" | "completed" | "failed";
  jobId?: string;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

type AssetEvents = { assetByID: Record<string, AssetState>; ready: boolean };
const EmptyAssetEvents: AssetEvents = { assetByID: {}, ready: false };
const AssetEventsContext = createContext<AssetEvents | null>(null);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalizeAsset(value: unknown): AssetState | null {
  const source = record(value);
  if (!source || typeof source.id !== "string" || !source.id) return null;
  const jobId = typeof source.jobId === "string" && source.jobId.trim() ? source.jobId : undefined;
  const reported = source.status === "queued" || source.status === "running" || source.status === "completed" || source.status === "failed" ? source.status : "completed";
  const status = (reported === "queued" || reported === "running") && !jobId ? "completed" : reported;
  const mimeType = typeof source.mimeType === "string" ? source.mimeType : "";
  const kind = source.kind === "image" || source.kind === "video" || source.kind === "audio" ? source.kind : mimeType.startsWith("video/") ? "video" : mimeType.startsWith("audio/") ? "audio" : "image";
  return {
    id: source.id,
    kind,
    status,
    jobId,
    error: typeof source.error === "string" ? source.error : undefined,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : undefined,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : undefined,
    metadata: record(source.metadata) ?? {},
  };
}

function parseEvent(event: Event) {
  try {
    return JSON.parse((event as MessageEvent<string>).data) as unknown;
  } catch {
    return null;
  }
}

function sameAsset(left: AssetState, right: AssetState) {
  return left.status === right.status && left.updatedAt === right.updatedAt && left.error === right.error;
}

function AssetEventsConnection({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AssetEvents>(EmptyAssetEvents);
  useEffect(() => {
    const stream = new EventSource("/v1/media/events");
    stream.addEventListener("media.snapshot", (event) => {
      const payload = record(parseEvent(event));
      const assets = Array.isArray(payload?.assets) ? payload.assets.map(normalizeAsset).filter((asset): asset is AssetState => Boolean(asset)) : [];
      setEvents({ assetByID: Object.fromEntries(assets.map((asset) => [asset.id, asset])), ready: true });
    });
    stream.addEventListener("asset.updated", (event) => {
      const asset = normalizeAsset(record(parseEvent(event))?.asset);
      if (asset) setEvents((current) => ({ assetByID: { ...current.assetByID, [asset.id]: asset }, ready: true }));
    });
    return () => stream.close();
  }, []);
  useEffect(() => {
    const pendingIDs = Object.values(events.assetByID)
      .filter((asset) => asset.status === "queued" || asset.status === "running")
      .map((asset) => asset.id);
    if (!pendingIDs.length) return;
    let active = true;
    const reconcile = async () => {
      const assets = await Promise.all(pendingIDs.map(async (id) => {
        try {
          const response = await fetch(`/v1/media/assets/${encodeURIComponent(id)}`);
          return response.ok ? normalizeAsset(await response.json()) : null;
        } catch {
          return null;
        }
      }));
      if (!active) return;
      setEvents((current) => {
        const updates = assets.flatMap((asset) => asset && !sameAsset(current.assetByID[asset.id] ?? asset, asset) ? [asset] : []);
        return updates.length ? { ...current, assetByID: { ...current.assetByID, ...Object.fromEntries(updates.map((asset) => [asset.id, asset])) } } : current;
      });
    };
    void reconcile();
    const timer = window.setInterval(() => void reconcile(), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [events.assetByID]);
  const value = useMemo(() => events, [events]);
  return <AssetEventsContext.Provider value={value}>{children}</AssetEventsContext.Provider>;
}

export function MediaAssetEventsProvider({ children }: { children: ReactNode }) {
  const parent = useContext(AssetEventsContext);
  if (parent) return <>{children}</>;
  return <AssetEventsConnection>{children}</AssetEventsConnection>;
}

export function useMediaAssetEvents() {
  return useContext(AssetEventsContext) ?? EmptyAssetEvents;
}
