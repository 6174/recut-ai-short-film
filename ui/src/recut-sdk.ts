/**
 * [INPUT]: 依赖 Host 注入的 MessageChannel
 * [OUTPUT]: 对外提供不依赖安全上下文 UUID、带通信诊断日志的 iframe React UI SDK 与项目事件订阅
 * [POS]: vox-broll 的 UI 通信边界；业务 UI 不直接 fetch、访问终端或 SQLite，实时事件由宿主转发
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
type RequestType = "state.query" | "background.call" | "agent.send";
type Request = { id: string; type: RequestType; input: Record<string, unknown> };
let port: MessagePort | null = null;
const pending = new Map<string, { type: RequestType; resolve: (value: any) => void; reject: (error: Error) => void }>();
let requestSequence = 0;

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
  console.warn(`[recut-sdk] host connected origin=${window.location.origin}`);
  window.dispatchEvent(new Event("recut-sdk-ready"));
});

function call(type: RequestType, input: Record<string, unknown>) {
  return new Promise<any>((resolve, reject) => {
    const id = requestID();
    if (!port) {
      console.warn(`[recut-sdk] request blocked: host not connected id=${id} type=${type}`);
      return reject(new Error("Recut Host 尚未连接"));
    }
    pending.set(id, { type, resolve, reject });
    console.warn(`[recut-sdk] request sent id=${id} type=${type}`);
    port.postMessage({ id, type, input } satisfies Request);
  });
}

export const recut = {
  state: { query: (name: string) => call("state.query", { name }) },
  background: { call: (name: string, input: Record<string, unknown>) => call("background.call", { name, ...input }) },
  agent: { send: (input: { prompt: string }) => call("agent.send", input) },
  events: { subscribe: (listener: (event: unknown) => void) => {
    const receive = (event: Event) => listener((event as CustomEvent<unknown>).detail);
    window.addEventListener("recut-project-event", receive);
    return () => window.removeEventListener("recut-project-event", receive);
  } },
};
