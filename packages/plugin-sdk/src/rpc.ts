/**
 * The envelope between a plugin page and the host. It is deliberately small: methods, arguments
 * and results are validated on both sides, and a failure is a value rather than an exception that
 * could cross the boundary.
 */
export type PluginErrorCode = "denied" | "invalid" | "timeout" | "unsupported" | "internal";

export interface PluginError {
  code: PluginErrorCode;
  message: string;
}

export type RpcResult<T> = { ok: true; value: T } | { ok: false; error: PluginError };

export interface RpcRequest {
  id: number;
  method: string;
  params: unknown;
}

export type RpcResponse = { id: number } & RpcResult<unknown>;

/** What the plugin preload exposes as `window.__pupitre`; the host page calls it. */
export interface PluginBridge {
  invoke(method: string, params?: unknown): Promise<unknown>;
  /** Called again when the user changes the plugin's settings. */
  onSettings(listener: (settings: unknown) => void): void;
}

export function rpcFailure(code: PluginErrorCode, message: string): RpcResult<never> {
  return { ok: false, error: { code, message } };
}
