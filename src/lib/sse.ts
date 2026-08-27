interface ChatStreamEventToken {
  type: "token";
  value: string;
}

interface ChatStreamEventDone {
  type: "done";
  messageId: string;
}

interface ChatStreamEventError {
  type: "error";
  message: string;
}

export type ChatStreamEvent =
  ChatStreamEventToken | ChatStreamEventDone | ChatStreamEventError;

export function encodeSseEvent(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSseChunk(buffer: string) {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: ChatStreamEvent[] = [];

  for (const part of parts) {
    const line = part.split("\n").find((l) => l.startsWith("data: "));

    if (!line) continue;

    try {
      events.push(JSON.parse(line.slice("data: ".length)));
    } catch {}
  }

  return { events, rest };
}
