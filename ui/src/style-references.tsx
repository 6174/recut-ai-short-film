/**
 * [INPUT]: 依赖 React 状态与 skills/ai-short-film/references/images 的约定文件名
 * [OUTPUT]: 对外提供内置 AI 短片风格模板、可点击封面选择器及本地封面缺失时的可读回退
 * [POS]: ai-short-film UI 的模板展示数据；与后端冻结的 template id 对齐，只消费随构建复制的静态风格封面，不参与 section 工作流依赖
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { useState } from "react";
import { useRecutLocale } from "./recut-sdk";
import { t } from "./i18n";

export type StyleTemplateReference = { id: string; name: string; summary: string; images: Array<{ label: string; path: string }> };

export const styleTemplateReferences: StyleTemplateReference[] = [
  { id: "editorial-vox", name: "style.editorial-vox.name", summary: "style.editorial-vox.summary", images: [{ label: "style.cover", path: "images/editorial-vox/cover.png" }] },
  { id: "hand-drawn-essay", name: "style.hand-drawn-essay.name", summary: "style.hand-drawn-essay.summary", images: [{ label: "style.cover", path: "images/hand-drawn-essay/cover.png" }] },
  { id: "animated-character", name: "style.animated-character.name", summary: "style.animated-character.summary", images: [{ label: "style.cover", path: "images/animated-character/cover.png" }] },
];

function TemplateCover({ template }: { template: StyleTemplateReference }) {
  const locale = useRecutLocale();
  const [failed, setFailed] = useState(false);
  const image = template.images[0];
  if (!image || failed) return <div className="grid aspect-[16/9] place-items-center bg-[linear-gradient(135deg,oklch(0.24_0.02_250),oklch(0.43_0.06_160))] p-4 text-center"><span className="text-sm font-medium tracking-wide text-white/90">{t(locale, template.name)}</span><span className="mt-1 text-[10px] text-white/65">{t(locale, "style.waitingCover")}</span></div>;
  return <img alt={t(locale, "style.coverAlt", { name: t(locale, template.name), label: t(locale, image.label) })} className="aspect-[16/9] w-full object-cover" onError={() => setFailed(true)} src={`./${image.path}`} />;
}

export function StyleTemplatePicker({ onChange, value }: { onChange: (templateID: string) => void; value: string }) {
  const locale = useRecutLocale();
  return <div className="grid gap-2"><p className="text-sm font-medium">{t(locale, "style.template")}</p><div className="grid gap-3 sm:grid-cols-3">{styleTemplateReferences.map((template) => <button aria-pressed={value === template.id} className={`overflow-hidden rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === template.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"}`} key={template.id} onClick={() => onChange(template.id)} type="button"><TemplateCover template={template} /><div className="p-2.5"><p className="text-sm font-medium">{t(locale, template.name)}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{t(locale, template.summary)}</p></div></button>)}</div><p className="text-[11px] leading-5 text-muted-foreground">{t(locale, "style.footnote")}</p></div>;
}
