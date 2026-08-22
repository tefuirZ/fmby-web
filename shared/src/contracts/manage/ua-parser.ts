// UserAgent / client_info 解析工具：从会话记录的 client_info 字段中提取
// 设备名、客户端名和 UA 摘要。
import type { RawManagedSessionRecord } from "./raw-types";

export function parseClientInfo(raw?: string | null) {
  if (!raw || raw.trim() === "") {
    return {
      deviceName: undefined,
      clientName: undefined,
      headerLabel: undefined,
    };
  }

  const value = raw.trim();
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as {
        device_name?: string;
        deviceName?: string;
        client_name?: string;
        clientName?: string;
        requested_with?: string;
        requestedWith?: string;
        user_agent?: string;
        userAgent?: string;
      };
      const requestedWith = parsed.requested_with ?? parsed.requestedWith;
      const userAgent = parsed.user_agent ?? parsed.userAgent;
      const headerLabel = [requestedWith, formatUserAgentLabel(userAgent)]
        .filter(Boolean)
        .join(" · ");
      return {
        deviceName:
          parsed.device_name ??
          parsed.deviceName ??
          buildDeviceNameFromUserAgent(userAgent),
        clientName:
          parsed.client_name ??
          parsed.clientName ??
          buildClientName(requestedWith, userAgent),
        headerLabel: headerLabel || undefined,
      };
    } catch {
      // fallback to legacy text parsing
    }
  }

  if (looksLikeUserAgent(value)) {
    return {
      deviceName: buildDeviceNameFromUserAgent(value),
      clientName: buildClientName(undefined, value),
      headerLabel: formatUserAgentLabel(value),
    };
  }

  if (value.includes(" / ")) {
    const [deviceName, clientName] = value.split(" / ", 2);
    return {
      deviceName: deviceName || undefined,
      clientName: clientName || undefined,
      headerLabel: undefined,
    };
  }

  const bracketIndex = value.lastIndexOf("(");
  if (bracketIndex > 0 && value.endsWith(")")) {
    return {
      deviceName: value.slice(0, bracketIndex).trim() || undefined,
      clientName: value.slice(bracketIndex + 1, -1).trim() || undefined,
      headerLabel: undefined,
    };
  }

  return {
    deviceName: value,
    clientName: value,
    headerLabel: undefined,
  };
}

export function buildSessionDeviceFallback(
  raw: RawManagedSessionRecord,
  status: "active" | "idle" | "expired" | "revoked",
) {
  const ipAddress = raw.ip_address?.trim();
  if (ipAddress === "127.0.0.1" || ipAddress === "::1") {
    return "本机回环会话";
  }
  if (ipAddress) {
    return `来自 ${ipAddress} 的会话`;
  }
  if (status === "expired" || status === "revoked") {
    return "历史会话";
  }
  return "未知设备";
}

export function buildSessionClientFallback(
  raw: RawManagedSessionRecord,
  status: "active" | "idle" | "expired" | "revoked",
) {
  if (raw.ip_address === "127.0.0.1" || raw.ip_address === "::1") {
    return "本机客户端";
  }
  if (status === "expired" || status === "revoked") {
    return "历史客户端";
  }
  return "未知客户端";
}

export function buildDeviceNameFromUserAgent(userAgent?: string | null) {
  const osLabel = detectOsLabel(userAgent);
  const clientLabel = detectClientLabel(userAgent);
  if (osLabel && clientLabel) {
    return `${osLabel} / ${clientLabel}`;
  }
  return osLabel ?? clientLabel ?? undefined;
}

export function buildClientName(
  requestedWith?: string | null,
  userAgent?: string | null,
) {
  const requestedWithLabel = requestedWith?.trim();
  if (requestedWithLabel === "FMBY-Web") {
    return "网页端";
  }
  if (requestedWithLabel) {
    return requestedWithLabel;
  }
  return detectClientLabel(userAgent) ?? undefined;
}

export function looksLikeUserAgent(value: string) {
  const lower = value.toLowerCase();
  return (
    lower.includes("mozilla/") ||
    lower.includes("applewebkit/") ||
    lower.includes("chrome/") ||
    lower.includes("safari/") ||
    lower.includes("firefox/") ||
    lower.includes("edg/") ||
    lower.includes("android") ||
    lower.includes("iphone") ||
    lower.includes("windows nt")
  );
}

export function detectClientLabel(userAgent?: string | null) {
  const lower = userAgent?.toLowerCase();
  if (!lower) {
    return undefined;
  }
  if (lower.includes("hills windows")) {
    return "Hills Windows";
  }
  if (lower.includes("infuse")) {
    return "Infuse";
  }
  if (lower.includes("emby")) {
    return "Emby";
  }
  if (lower.includes("edg/")) {
    return "Edge";
  }
  if (lower.includes("chrome/")) {
    return "Chrome";
  }
  if (lower.includes("firefox/")) {
    return "Firefox";
  }
  if (lower.includes("safari/")) {
    return "Safari";
  }
  return undefined;
}

export function detectOsLabel(userAgent?: string | null) {
  const lower = userAgent?.toLowerCase();
  if (!lower) {
    return undefined;
  }
  if (lower.includes("windows")) {
    return "Windows";
  }
  if (lower.includes("mac os") || lower.includes("macintosh")) {
    return "macOS";
  }
  if (lower.includes("android")) {
    return "Android";
  }
  if (
    lower.includes("iphone") ||
    lower.includes("ipad") ||
    lower.includes("ios")
  ) {
    return "iOS";
  }
  if (lower.includes("linux")) {
    return "Linux";
  }
  return undefined;
}

export function formatUserAgentLabel(userAgent?: string | null) {
  if (!userAgent) {
    return undefined;
  }
  return userAgent.length > 48 ? `${userAgent.slice(0, 48)}...` : userAgent;
}
