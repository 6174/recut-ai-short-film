/**
 * [INPUT]: 依赖 React 状态与 skills/vox-broll/references/images 的约定文件名
 * [OUTPUT]: 对外提供内置 AI 短片风格模板、可点击封面选择器及本地封面缺失时的可读回退
 * [POS]: vox-broll UI 的模板展示数据；与后端冻结的 template id 对齐，只消费随构建复制的静态风格封面，不参与 section 工作流依赖
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { useState } from "react";

export type StyleTemplateReference = { id: string; name: string; summary: string; images: Array<{ label: string; path: string }> };

export const styleTemplateReferences: StyleTemplateReference[] = [
  { id: "editorial-vox", name: "Vox 编辑解说", summary: "资料、数据与纸质拼贴推动清晰论点。", images: [{ label: "风格封面", path: "images/editorial-vox/cover.png" }] },
  { id: "hand-drawn-essay", name: "手绘随笔", summary: "铅笔、墨线与纸面动画讲述具体思考。", images: [{ label: "风格封面", path: "images/hand-drawn-essay/cover.png" }] },
  { id: "animated-character", name: "卡通角色叙事", summary: "固定角色与可见行动推动故事。", images: [{ label: "风格封面", path: "images/animated-character/cover.png" }] },
];

function TemplateCover({ template }: { template: StyleTemplateReference }) {
  const [failed, setFailed] = useState(false);
  const image = template.images[0];
  if (!image || failed) return <div className="grid aspect-[16/9] place-items-center bg-[linear-gradient(135deg,oklch(0.24_0.02_250),oklch(0.43_0.06_160))] p-4 text-center"><span className="text-sm font-medium tracking-wide text-white/90">{template.name}</span><span className="mt-1 text-[10px] text-white/65">等待 cover.png</span></div>;
  return <img alt={`${template.name} · ${image.label}`} className="aspect-[16/9] w-full object-cover" onError={() => setFailed(true)} src={`./${image.path}`} />;
}

export function StyleTemplatePicker({ onChange, value }: { onChange: (templateID: string) => void; value: string }) {
  return <div className="grid gap-2"><p className="text-sm font-medium">风格模板</p><div className="grid gap-3 sm:grid-cols-3">{styleTemplateReferences.map((template) => <button aria-pressed={value === template.id} className={`overflow-hidden rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === template.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"}`} key={template.id} onClick={() => onChange(template.id)} type="button"><TemplateCover template={template} /><div className="p-2.5"><p className="text-sm font-medium">{template.name}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{template.summary}</p></div></button>)}</div><p className="text-[11px] leading-5 text-muted-foreground">封面只用于选择模板；手绘、角色和镜头参考在项目后续由你生成或上传。</p></div>;
}
