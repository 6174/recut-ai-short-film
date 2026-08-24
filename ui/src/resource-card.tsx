/**
 * [INPUT]: 依赖 Resource 类型、状态感知的图片/视频资产预览与真实资源缩略文本
 * [OUTPUT]: 对外提供素材库式只读缩略图项目、真实画面预览与运行/终态生成耗时
 * [POS]: ai-short-film 的资源浏览单元；资源由单线工作流管理，不暴露删除或移出操作，详情交由模态框承载
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import type { Resource } from "./main";
import { useRecutLocale } from "./recut-sdk";
import { t } from "./i18n";
import { AssetImagePreview, AssetVideoPreview, ResourcePresentation, resourceImageAssetIDs, resourcePreviewLines, resourceVideoAssetIDs } from "./resource-view";

function TextPreview({ resource }: { resource: Resource }) {
  const locale = useRecutLocale();
  const lines = resourcePreviewLines(resource);
  return <div className="grid h-full content-center gap-1.5 bg-primary/[0.035] p-3">{lines.length ? lines.map((line, index) => <p className={`line-clamp-2 text-xs leading-4 ${index === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`} key={line}>{line}</p>) : <p className="text-xs text-muted-foreground">{t(locale, "card.emptyText")}</p>}</div>;
}

function Preview({ resource }: { resource: Resource }) {
  const locale = useRecutLocale();
  const video = ["scenes", "delivery"].includes(resource.kind.toLowerCase()) ? resourceVideoAssetIDs(resource)[0] : "";
  const image = resourceImageAssetIDs(resource)[0];
  if (video) return <AssetVideoPreview assetId={video} title={resource.title} />;
  if (image) return <AssetImagePreview alt={t(locale, "card.thumbnail", { title: resource.title })} assetId={image} className="size-full" compact />;
  if (resource.kind.toLowerCase() === "look") return <div className="h-full overflow-hidden"><ResourcePresentation compact resource={resource} /></div>;
  return <TextPreview resource={resource} />;
}

export function ResourceCard({ onClick, resource }: { onClick: () => void; resource: Resource }) {
  const locale = useRecutLocale();
  return <article className="group relative w-[156px] shrink-0 transition-transform duration-150 ease-out hover:z-10 hover:scale-[1.035]"><button aria-haspopup="dialog" aria-label={t(locale, "card.view", { title: resource.title })} className="block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onClick} type="button"><div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border/80 bg-card shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-all duration-150 group-hover:border-primary/70 group-hover:shadow-[0_8px_20px_rgb(15_23_42/0.12)]"><Preview resource={resource} /></div><h3 className="mt-1.5 truncate text-xs font-medium leading-5 text-foreground/90">{resource.title}</h3></button></article>;
}
