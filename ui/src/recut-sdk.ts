/**
 * [INPUT]: 依赖 Host 注入的 MessageChannel，并向 Host 发出可重试的 UI 就绪握手
 * [OUTPUT]: 对外提供等待 Host MessageChannel 就绪、不依赖安全上下文 UUID、带通信诊断日志的 iframe React UI SDK、只回填不提交的 Agent compose 请求、当前页面上下文上报与项目事件订阅
 * [POS]: ai-short-film 的 UI 通信边界；业务 UI 不直接 fetch、访问终端或 SQLite，实时事件由宿主转发，Agent 内容必须经全局 chat 可见
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { useEffect, useState } from "react";

export type Locale = "zh" | "en";

export function getRecutLocale(): Locale {
  const requested = new URLSearchParams(location.search).get("locale");
  if (requested === "zh" || requested === "en") return requested;
  return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function useRecutLocale(): Locale {
  const [locale] = useState<Locale>(getRecutLocale);
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh";
  }, [locale]);
  return locale;
}

type RequestType = "state.query" | "background.call" | "agent.compose" | "focus.report" | "page.context" | "media.pick";
type Request = { id: string; type: RequestType; input: Record<string, unknown> };
let port: MessagePort | null = null;
let resolveConnection: ((nextPort: MessagePort) => void) | null = null;
const connection = new Promise<MessagePort>((resolve) => { resolveConnection = resolve; });
const pending = new Map<string, { type: RequestType; resolve: (value: any) => void; reject: (error: Error) => void }>();
let requestSequence = 0;
let readyAttempts = 0;
const hostOrigin = document.referrer ? new URL(document.referrer).origin : "*";

function announceReady() {
  if (port || window.parent === window || readyAttempts >= 40) return;
  readyAttempts += 1;
  window.parent.postMessage({ type: "recut.ui.ready" }, hostOrigin);
}

const readyTimer = window.setInterval(announceReady, 250);

function requestID() {
  requestSequence += 1;
  return `request-${Date.now().toString(36)}-${requestSequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}

window.addEventListener("message", (event) => {
  if (event.data?.type === "recut.project.event") {
    window.dispatchEvent(new CustomEvent("recut-project-event", { detail: event.data.event }));
    return;
  }
  if (event.data?.type !== "recut.ui.connect" || !event.ports[0]) return;
  port = event.ports[0];
  port.onmessage = (message) => {
    const request = pending.get(message.data?.id);
    if (!request) return;
    pending.delete(message.data.id);
    if (message.data.error) {
      console.error(`[recut-sdk] response failed id=${message.data.id} type=${request.type}: ${message.data.error}`);
      request.reject(new Error(message.data.error));
      return;
    }
    console.warn(`[recut-sdk] response received id=${message.data.id} type=${request.type}`);
    request.resolve(message.data.result);
  };
  port.start();
  resolveConnection?.(port);
  resolveConnection = null;
  window.clearInterval(readyTimer);
  console.warn(`[recut-sdk] host connected origin=${window.location.origin}`);
  window.dispatchEvent(new Event("recut-sdk-ready"));
});

announceReady();

async function call(type: RequestType, input: Record<string, unknown>) {
  const activePort = port ?? await connection;
  return new Promise<any>((resolve, reject) => {
    const id = requestID();
    pending.set(id, { type, resolve, reject });
    console.warn(`[recut-sdk] request sent id=${id} type=${type}`);
    activePort.postMessage({ id, type, input } satisfies Request);
  });
}

export const recut = {
  state: { query: (name: string) => call("state.query", { name }) },
  background: { call: (name: string, input: Record<string, unknown>) => call("background.call", { name, ...input }) },
  agent: {
    compose: (input: { prompt: string }) => call("agent.compose", input),
  },
  media: {
    pick: (input: { kinds: Array<"image" | "video" | "audio" | "transcript" | "reference">; multiple?: boolean; selectedIDs?: string[] }) => call("media.pick", input),
  },
	page: {
    // 上报当前编辑页面的结构化上下文；Host 会在用户发送消息时自动附带为
    // type=page 的上下文（可在 Composer 移除）。
		context: (context: { title: string; path?: string; url?: string; selection?: string; content?: string }) =>
			call("page.context", { context }),
	},
	focus: {
		report: (focus: { view?: string; selection?: Array<{ kind: "timeline_element" | "timeline_track" | "component" | "asset" | "world_entity" | "world_evidence"; id: string }>; selectionState?: Record<string, unknown>; cursor?: { kind: "time"; seconds: number } | { kind: "none" }; state?: Record<string, unknown>; summary?: string }) =>
			call("focus.report", { focus }),
	},
  events: { subscribe: (listener: (event: unknown) => void) => {
    const receive = (event: Event) => listener((event as CustomEvent<unknown>).detail);
    window.addEventListener("recut-project-event", receive);
    return () => window.removeEventListener("recut-project-event", receive);
  } },
};
