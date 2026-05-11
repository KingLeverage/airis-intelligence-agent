/**
 * Intercepts AIRIS “command line” (floating bar) input before chat POST.
 * Keep patterns strict so normal conversation is not hijacked.
 */

export type LocalAirisCommandResult =
  | {
      handled: true;
      message: string;
      openBrowser?: { url?: string };
      createWorkspace?: { name: string };
      /** Name substring or full workspace UUID */
      deleteWorkspace?: { query: string };
    }
  | { handled: false };

function isHttpUrlToken(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

export function handleLocalAirisCommand(text: string): LocalAirisCommandResult {
  const t = text.trim();
  if (!t) return { handled: false };

  const tryUrl = (raw?: string): string | undefined => {
    if (!raw) return undefined;
    const u = raw.trim();
    if (!u) return undefined;
    if (!isHttpUrlToken(u)) return undefined;
    return u;
  };

  let m = /^(?:please\s+)?open\s+browser(?:\s+(\S+))?$/i.exec(t);
  if (m) {
    const url = tryUrl(m[1]);
    if (m[1] && !url) {
      return {
        handled: true,
        message: "Opened browser. Add a full URL like https://www.wikipedia.org/ after “open browser” to go there directly.",
        openBrowser: {},
      };
    }
    return {
      handled: true,
      message: url ? `Opened browser to ${url}.` : "Opened browser.",
      openBrowser: { url },
    };
  }

  m = /^\/browser(?:\s+(\S+))?$/i.exec(t);
  if (m) {
    const url = tryUrl(m[1]);
    if (m[1] && !url) {
      return {
        handled: true,
        message: "Opened browser. Usage: /browser https://…",
        openBrowser: {},
      };
    }
    return {
      handled: true,
      message: url ? `Opened browser to ${url}.` : "Opened browser.",
      openBrowser: { url },
    };
  }

  m = /^browser\s+(https?:\/\/\S+)$/i.exec(t);
  if (m) {
    return { handled: true, message: `Opened browser to ${m[1]}.`, openBrowser: { url: m[1] } };
  }

  if (/^(show\s+browser|browser\s+open)$/i.test(t)) {
    return { handled: true, message: "Opened browser.", openBrowser: {} };
  }

  if (/\bopen\s+example\.com\s+in\s+the\s+browser\b/i.test(t)) {
    return {
      handled: true,
      message: "Opened browser to https://example.com.",
      openBrowser: { url: "https://example.com" },
    };
  }

  m = /^(?:create|new)\s+(?:workspace|space)\s+(.+)$/i.exec(t);
  if (m) {
    const name = m[1].trim().replace(/\s+/g, " ") || "New workspace";
    return {
      handled: true,
      message: `Creating workspace “${name}”…`,
      createWorkspace: { name },
    };
  }

  if (/^(?:create|new)\s+(?:workspace|space)\s*$/i.test(t)) {
    return {
      handled: true,
      message: "Creating workspace “New workspace”…",
      createWorkspace: { name: "New workspace" },
    };
  }

  m = /^(?:delete|remove)\s+(?:workspace|space)\s+(.+)$/i.exec(t);
  if (m) {
    const query = m[1].trim().replace(/\s+/g, " ");
    if (query) {
      return {
        handled: true,
        message: `Deleting workspace matching “${query}”…`,
        deleteWorkspace: { query },
      };
    }
  }

  m = /^\/delete-space\s+(\S.+)$/i.exec(t);
  if (m) {
    const query = m[1].trim();
    return {
      handled: true,
      message: `Deleting workspace matching “${query}”…`,
      deleteWorkspace: { query },
    };
  }

  return { handled: false };
}
