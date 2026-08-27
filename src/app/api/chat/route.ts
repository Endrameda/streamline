import { db } from "@/db";
import {
  getConversation,
  getMessages,
  getOrCreateDemoUser,
  insertMessage,
  touchConversation,
  updateMessageContent,
} from "@/db/queries";
import { conversations } from "@/db/schema";
import { anthropic, CHAT_MODEL, SYSTEM_PROMPT } from "@/lib/anthropic";
import { encodeSseEvent } from "@/lib/sse";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(8000),
});

const PERSIST_EVERY_CHARS = 40;

export async function POST(request: Request) {
  const user = await getOrCreateDemoUser();
  const parsed = bodySchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { conversationId, message } = parsed.data;
  const conversation = await getConversation(conversationId, user.id);

  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const history = await getMessages(conversationId);
  await insertMessage({ conversationId, role: "user", content: message });

  if (conversation.title === "New conversation") {
    const title = message.length > 60 ? `${message.slice(0, 57)}...` : message;
    await db
      .update(conversations)
      .set({ title })
      .where(eq(conversations.id, conversationId));
  }

  const assistantMessage = await insertMessage({
    conversationId,
    role: "assistant",
    content: "",
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: Parameters<typeof encodeSseEvent>[0]) =>
        controller.enqueue(encoder.encode(encodeSseEvent(event)));

      let fullText = "";
      let sinceLastPersist = 0;
      // If the client disconnects, `request.signal` fires — we still want
      // to persist whatever we've got so a resumed conversation shows a
      // partial (not silently missing) assistant reply.
      let clientDisconnected = false;
      request.signal.addEventListener("abort", () => {
        clientDisconnected = true;
      });

      try {
        const anthropicStream = anthropic.messages.stream({
          model: CHAT_MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            ...history.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "user" as const, content: message },
          ],
        });

        for await (const event of anthropicStream) {
          if (clientDisconnected) break;

          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            sinceLastPersist += event.delta.text.length;
            send({ type: "token", value: event.delta.text });

            if (sinceLastPersist >= PERSIST_EVERY_CHARS) {
              sinceLastPersist = 0;
              await updateMessageContent(assistantMessage.id, fullText, false);
            }
          }
        }

        await updateMessageContent(
          assistantMessage.id,
          fullText,
          !clientDisconnected,
        );
        await touchConversation(conversationId);

        if (!clientDisconnected) {
          send({ type: "done", messageId: assistantMessage.id });
        }
      } catch (err) {
        // Persist whatever partial text we have — completedAt stays null,
        // which the UI reads as "this reply was cut short."
        await updateMessageContent(assistantMessage.id, fullText, false);
        await touchConversation(conversationId);
        if (!clientDisconnected) {
          const message = err instanceof Error ? err.message : "Stream failed";
          send({ type: "error", message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
