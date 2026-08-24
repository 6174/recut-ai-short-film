/**
 * [INPUT]: 依赖 Resource 类型、共享 Asset SSE 缓存与 React 图文展示原语
 * [OUTPUT]: 对外提供按 AI 短片阶段渲染的人类可读资源摘要、缩略文本、带生成耗时的 iframe 视频预览、图片与按需音视频播放器详情；立项同时呈现风格/画幅/时长，资料研究/创作方案/剧本与场景方案显示其审核与场景清单，兼容顶层和历史嵌套视频引用
 * [POS]: ai-short-film 的资源展示语义层；将导演配置、研究资料、方案、剧本与生成媒体翻译为图文，所有异步 Asset 由共享缓存驱动并在真实生成态显示计时，终态只读取后端 generation metadata
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { useEffect, useState } from "react";
import type { Resource } from "./main";
import { getRecutLocale, useRecutLocale, type Locale } from "./recut-sdk";
import { t } from "./i18n";
import { type AssetState, useMediaAssetEvents } from "./use-media-asset-events";
import { VideoFrame } from "./video-frame";

type RecordValue = Record<string, unknown>;
type MediaSnapshot = { assetId?: string; text?: string; imageAssetIds?: string[] };
type LookContent = { media?: MediaSnapshot; definition?: string };

const mediaURL = (assetId: string) => `/v1/media/assets/${encodeURIComponent(assetId)}/content`;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown, locale: Locale = getRecutLocale()): string => Array.isArray(value) ? value.map((item) => text(item, locale)).filter(Boolean).join(locale === "en" ? ", " : "、") : typeof value === "string" || typeof value === "number" ? String(value) : "";
const title = (key: string, locale: Locale) => {
  const lookup = t(locale, `field.${key}`);
  return lookup !== `field.${key}` ? lookup : key.replace(/([A-Z])/g, " $1").trim();
};
const isLook = (resource: Resource) => resource.kind.toLowerCase() === "look";
const isGenerating = (asset: AssetState | null) => asset?.status === "queued" || asset?.status === "running";

function timestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function generationStartedAt(asset: AssetState | null) {
  return timestamp(asset?.metadata?.generationStartedAt) ?? timestamp(asset?.createdAt);
}

function finalGenerationDuration(asset: AssetState | null) {
  const value = asset?.metadata?.generationDurationMs;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function formatGenerationDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function useGenerationElapsedMs(asset: AssetState | null) {
  const startedAt = generationStartedAt(asset);
  const generating = isGenerating(asset);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!generating || startedAt === null) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [generating, startedAt]);
  if (generating) return startedAt === null ? null : Math.max(0, now - startedAt);
  const finalDuration = finalGenerationDuration(asset);
  return finalDuration;
}

function GenerationDuration({ asset, overlay = false }: { asset: AssetState | null; overlay?: boolean }) {
  const locale = useRecutLocale();
  const elapsed = useGenerationElapsedMs(asset);
  if (elapsed === null) return null;
  const label = isGenerating(asset) ? `${asset?.status === "queued" ? t(locale, "view.queued") : t(locale, "view.generating")} · ${formatGenerationDuration(elapsed)}` : t(locale, "view.generationTime", { time: formatGenerationDuration(elapsed) });
  return <p className={overlay ? "absolute bottom-1.5 right-1.5 rounded bg-background/90 px-1.5 py-0.5 font-mono text-[10px] text-foreground shadow-sm backdrop-blur" : "mt-1 font-mono text-[11px] text-muted-foreground"}>{label}</p>;
}

export function useAssetState(assetId: string) {
  const { assetByID, ready } = useMediaAssetEvents();
  return assetByID[assetId] ?? (ready ? { id: assetId, kind: "image" as const, status: "failed" as const, error: t(getRecutLocale(), "view.assetMissing") } : null);
}

function PendingMedia({ asset, compact = false }: { asset: AssetState | null; compact?: boolean }) {
  const locale = useRecutLocale();
  const failed = asset?.status === "failed";
  const loading = !asset;
  const pendingLabel = asset?.status === "queued" ? t(locale, "view.queuedPending") : t(locale, "view.generatingPending");
  return <div className={`grid place-items-center border border-dashed bg-muted/40 px-3 text-center text-xs text-muted-foreground ${compact ? "size-full border-0" : "min-h-20 rounded"}`}><div><p className={failed ? "font-medium text-destructive" : "font-medium text-primary"}>{failed ? t(locale, "view.failed") : loading ? t(locale, "view.loading") : pendingLabel}</p><GenerationDuration asset={asset} /><p className="mt-1 text-[11px] leading-4">{asset?.error || t(locale, "view.referenceReady")}</p></div></div>;
}

export function AssetImagePreview({ alt, assetId, className, compact = false }: { alt: string; assetId: string; className: string; compact?: boolean }) {
  const asset = useAssetState(assetId);
  if (!asset || asset.status !== "completed") return <PendingMedia asset={asset} compact={compact} />;
  return <div className={`relative overflow-hidden ${className}`}><img alt={alt} className="size-full object-cover" src={mediaURL(assetId)} /><GenerationDuration asset={asset} overlay /></div>;
}

function AssetPlayer({ assetId, kind }: { assetId: string; kind: "video" | "audio" }) {
  const locale = useRecutLocale();
  const asset = useAssetState(assetId);
  if (!asset || asset.status !== "completed") return <PendingMedia asset={asset} />;
  const player = kind === "video" ? <VideoFrame alt={t(locale, "view.sceneVideo")} className="w-full rounded-md border" controls src={mediaURL(assetId)} /> : <audio className="w-full" controls src={mediaURL(assetId)} />;
  return <div className="grid gap-1">{player}<GenerationDuration asset={asset} /></div>;
}

export function AssetVideoPreview({ assetId, title }: { assetId: string; title: string }) {
  const locale = useRecutLocale();
  const asset = useAssetState(assetId);
  if (!asset || asset.status !== "completed") return <PendingMedia asset={asset} compact />;
  return <div className="relative size-full"><VideoFrame alt={t(locale, "view.videoPreview", { title })} className="size-full !aspect-auto" src={mediaURL(assetId)} /><GenerationDuration asset={asset} overlay /></div>;
}

export function isLegacyLook(resource: Resource) {
  const content = record(resource.content);
  const media = record(content.media);
  return isLook(resource) && (!text(media.assetId) || !text(media.text));
}

function ids(content: RecordValue, singular: string, plural: string) {
  const values = [content[singular], ...(Array.isArray(content[plural]) ? content[plural] : [])];
  return [...new Set(values.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

function imageIDs(content: RecordValue) {
  const assetIDs = [content.assetId, content.imageAssetId, content.referenceAssetId, ...ids(content, "imageAssetId", "imageAssetIds"), ...ids(content, "referenceAssetId", "referenceAssetIds")];
  return [...new Set(assetIDs.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

function snapshotAssetID(value: unknown) {
  return text(record(value).assetId);
}

function videoAssetIDs(content: RecordValue) {
  const items = [...(Array.isArray(content.scenes) ? content.scenes : []), ...(Array.isArray(content.shots) ? content.shots : [])];
  const nested = items.flatMap((item) => {
    const value = record(item);
    return [snapshotAssetID(value.video), ...ids(value, "videoAssetId", "videoAssetIds")];
  });
  return [...new Set([snapshotAssetID(content.video), ...ids(content, "videoAssetId", "videoAssetIds"), ...nested].filter(Boolean))];
}

export function resourceVideoAssetIDs(resource: Resource) {
  const content = record(resource.content);
  const exported = resource.kind.toLowerCase() === "delivery" ? text(content.assetId) : "";
  const nested = [content.scenes, content.shots]
    .filter(Array.isArray)
    .flatMap((items) => items.flatMap((item) => videoAssetIDs(record(item))));
  return [...new Set([exported, ...videoAssetIDs(content), ...nested].filter(Boolean))];
}

function audioSnapshotID(value: unknown) {
  return snapshotAssetID(record(value).audio) || text(record(value).audioAssetId);
}

function itemHeading(value: RecordValue, item: unknown) {
  return text(value.title || value.name || value.shot || value.beat || value.id || item);
}

function itemDetails(value: RecordValue) {
  return ["description", "action", "narration", "visual", "purpose", "composition", "motion", "music", "soundEffects", "captions", "durationSec"]
    .map((key) => text(value[key]))
    .filter(Boolean);
}

export function resourceImageAssetIDs(resource: Resource) {
  const content = record(resource.content);
  if (resource.kind.toLowerCase() === "delivery") return [];
  const lookAssetID = isLook(resource) ? text(record(content.media).assetId) : "";
  const keyframeImages = resource.kind.toLowerCase() === "keyframes" && Array.isArray(content.keyframes)
    ? content.keyframes.map((item) => snapshotAssetID(record(item).image))
    : [];
  return [...new Set([lookAssetID, ...imageIDs(content), ...keyframeImages].filter(Boolean))];
}

export function resourceImageURLs(resource: Resource) {
  return resourceImageAssetIDs(resource).map(mediaURL);
}

export function resourcePreviewLines(resource: Resource) {
  const content = record(resource.content);
  const kind = resource.kind.toLowerCase();
  const fields = kind === "brief" ? ["topic", "details", "styleTemplate", "aspectRatio", "expectedDurationSec", "premise", "direction"] : kind === "research" ? ["researchQuestion", "coverageSummary", "status"] : kind === "proposals" ? ["framing", "selectionStatus"] : kind === "script" ? ["title", "logline", "screenplay"] : kind === "beats" ? ["hook", "narrative", "summary"] : kind === "keyframes" ? ["composition", "headline", "layers"] : kind === "audio" ? ["narration", "music", "captions"] : kind === "scenes" ? ["scene", "videoDirection"] : kind === "delivery" ? ["aspectRatio", "duration", "format", "export"] : ["summary", "definition", "direction"];
  const list = kind === "research" ? content.sources : kind === "proposals" ? content.candidates : kind === "script" ? content.scenes : kind === "beats" ? content.beats || content.items : kind === "keyframes" ? content.keyframes || content.shots : kind === "audio" ? content.scenes : kind === "scenes" ? content.scenes || content.shots : undefined;
  const entries = Array.isArray(list) ? list.map((item) => {
    const value = record(item);
    return [itemHeading(value, item), ...itemDetails(value)];
  }).flat() : [];
  const lines = [...fields.map((key) => text(content[key])), ...entries].filter(Boolean);
  return [...new Set(lines)].slice(0, 3);
}

function AssetImages({ content, compact = false }: { content: RecordValue; compact?: boolean }) {
  const locale = useRecutLocale();
  const assetIDs = imageIDs(content);
  if (!assetIDs.length) return null;
  return <div className={compact ? "aspect-video overflow-hidden rounded-md bg-muted" : "grid gap-3 sm:grid-cols-2"}>{assetIDs.map((id) => <AssetImagePreview alt={t(locale, "view.referenceImage")} assetId={id} className={compact ? "size-full" : "aspect-video w-full rounded-md border"} compact={compact} key={id} />)}</div>;
}

function MediaPlayers({ content, compact }: { content: RecordValue; compact: boolean }) {
  if (compact) return null;
  const videos = videoAssetIDs(content);
  const audio = ids(content, "audioAssetId", "audioAssetIds");
  if (!videos.length && !audio.length) return null;
  return <div className="grid gap-3">{videos.map((id) => <AssetPlayer assetId={id} key={id} kind="video" />)}{audio.map((id) => <AssetPlayer assetId={id} key={id} kind="audio" />)}</div>;
}

function Field({ name, value, locale }: { name: string; value: unknown; locale: Locale }) {
  const content = text(value, locale);
  return content ? <div className="grid gap-1"><dt className="text-xs font-medium text-muted-foreground">{title(name, locale)}</dt><dd className="text-sm leading-6 text-foreground">{content}</dd></div> : null;
}

function ItemList({ items, titleKey, locale }: { items: unknown; titleKey: string; locale: Locale }) {
  if (!Array.isArray(items) || !items.length) return null;
  return <div className="grid gap-2"><p className="text-xs font-medium text-muted-foreground">{t(locale, titleKey)}</p><ol className="grid gap-2">{items.map((item, index) => {
    const value = record(item);
    const heading = itemHeading(value, item) || t(locale, "view.itemFallback", { index: index + 1 });
    const detail = itemDetails(value).filter((detail) => detail !== heading).join(" · ");
    const image = snapshotAssetID(value.image) || text(value.imageAssetId);
    const video = snapshotAssetID(value.video) || text(value.videoAssetId);
    const audio = audioSnapshotID(value);
    return <li className="grid gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm" key={`${heading}-${index}`}><p className="font-medium">{index + 1}. {heading}</p>{detail && detail !== heading && <p className="leading-5 text-muted-foreground">{detail}</p>}{image && <AssetImagePreview alt={t(locale, "view.itemReferenceImage", { heading })} assetId={image} className="aspect-video w-full rounded border" />}{video && <AssetPlayer assetId={video} kind="video" />}{audio && <AssetPlayer assetId={audio} kind="audio" />}</li>;
  })}</ol></div>;
}

function LookView({ content, compact }: { content: RecordValue; compact: boolean }) {
  const locale = useRecutLocale();
  const look = content as LookContent;
  const media = look.media || {};
  const incomplete = !media.assetId || !media.text;
  if (incomplete) return <div className="rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">{compact ? t(locale, "view.lookMissing") : t(locale, "view.lookLegacy")}</div>;
  return <div className="grid gap-3"><AssetImages compact={compact} content={{ ...content, assetId: media.assetId }} />{!compact && <Field name="prompt" value={media.text} locale={locale} />}{!compact && <Field name="definition" value={look.definition} locale={locale} />}{compact && <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{media.text || look.definition || t(locale, "view.lookPromptMissing")}</p>}{!compact && <div className="grid gap-3 sm:grid-cols-2"><Field name="palette" value={content.palette} locale={locale} /><Field name="paperTechnique" value={content.paperTechnique} locale={locale} /><Field name="typeTreatment" value={content.typeTreatment} locale={locale} /><Field name="texture" value={content.texture} locale={locale} /><Field name="mood" value={content.mood} locale={locale} /></div>}</div>;
}

function StageView({ resource, compact }: { resource: Resource; compact: boolean }) {
  const locale = useRecutLocale();
  const content = record(resource.content);
  if (isLook(resource)) return <LookView compact={compact} content={content} />;
  const kind = resource.kind.toLowerCase();
  const list = kind === "research" ? content.sources : kind === "proposals" ? content.candidates : kind === "script" ? content.scenes : kind === "beats" ? content.beats || content.items : kind === "keyframes" ? content.keyframes || content.shots : kind === "audio" ? content.scenes : kind === "scenes" ? content.scenes || content.shots : kind === "delivery" ? content.checklist : undefined;
  const fields = kind === "brief" ? ["topic", "details", "styleTemplate", "aspectRatio", "expectedDurationSec", "premise", "direction"] : kind === "research" ? ["researchQuestion", "coverageSummary", "status"] : kind === "proposals" ? ["framing", "selectionStatus"] : kind === "script" ? ["title", "logline", "screenplay"] : kind === "beats" ? ["hook", "narrative", "summary"] : kind === "keyframes" ? ["composition", "headline", "layers"] : kind === "audio" ? ["narration", "music", "captions", "mix"] : kind === "scenes" ? ["beatId", "durationSec", "visualAction", "cutPoint"] : kind === "delivery" ? ["aspectRatio", "duration", "format", "export"] : ["summary", "definition", "direction"];
  const first = fields.map((key) => text(content[key])).find(Boolean) || text(resource.content) || t(locale, "view.noContent");
  if (compact) return <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{first}</p>;
  const exportedVideo = kind === "delivery" ? text(content.assetId) : "";
  return <div className="grid gap-4">{exportedVideo ? <AssetPlayer assetId={exportedVideo} kind="video" /> : <><AssetImages content={content} /><MediaPlayers compact={compact} content={content} /></>}<dl className="grid gap-3 sm:grid-cols-2">{fields.map((key) => <Field key={key} name={key} value={content[key]} locale={locale} />)}</dl><ItemList items={list} titleKey={kind === "research" ? "view.list.sources" : kind === "proposals" ? "view.list.candidates" : kind === "script" ? "view.list.scenes" : kind === "keyframes" ? "view.list.keyframes" : kind === "audio" ? "view.list.audio" : kind === "scenes" ? "view.list.sceneVideos" : kind === "delivery" ? "view.list.checklist" : "view.list.beats"} locale={locale} /></div>;
}

export function resourceSummary(resource: Resource) {
  const content = record(resource.content);
  if (isLook(resource)) return text(content.definition || record(content.media).text) || t(getRecutLocale(), "view.styleReference");
  return resourcePreviewLines(resource)[0] || t(getRecutLocale(), "view.clickForDetails");
}

export function ResourcePresentation({ compact = false, resource }: { compact?: boolean; resource: Resource }) {
  return <StageView compact={compact} resource={resource} />;
}

export function resourceKindLabel(kind: string, locale: Locale = "zh") {
  const lookup = t(locale, `kind.${kind.toLowerCase()}`);
  return lookup === `kind.${kind.toLowerCase()}` ? kind : lookup;
}
