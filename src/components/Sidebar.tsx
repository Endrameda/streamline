import { createConversationAction } from "@/app/actions";
import { getOrCreateDemoUser, listConversations } from "@/db/queries";
import Link from "next/link";
import DeleteConversationButton from "./DeleteConversationButton";

export default async function Sidebar() {
  const user = await getOrCreateDemoUser();
  const conversations = await listConversations(user.id);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <form action={createConversationAction}>
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:cursor-pointer hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + New conversation
          </button>
        </form>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="p-2 text-sm text-zinc-500">No conversations yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversations.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <Link
                  href={`/conversations/${c.id}`}
                  className="flex-1 truncate rounded-md px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  title={c.title}
                >
                  {c.title}
                </Link>
                <DeleteConversationButton conversationId={c.id} />
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
