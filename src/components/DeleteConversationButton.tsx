"use client";

import { useTransition } from "react";
import { deleteConversationAction } from "@/app/actions";

interface DeleteConversationButtonProps {
    conversationId: string;
}

export default function DeleteConversationButton(props: DeleteConversationButtonProps) {
    const { conversationId } = props
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="Delete conversation"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this conversation?")) return;
        startTransition(() => {
          deleteConversationAction(conversationId);
        });
      }}
      className="shrink-0 rounded-md p-2 text-zinc-400 opacity-0 hover:cursor-pointer hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50 dark:hover:bg-red-950"
    >
      ✕
    </button>
  );
}
