import { notFound } from "next/navigation";
import ChatView from "@/components/ChatView";
import { getConversation, getMessages, getOrCreateDemoUser } from "@/db/queries";

interface ConversationPageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage(props: ConversationPageProps) {
  const { params } = props;
  const { id } = await params;
  const user = await getOrCreateDemoUser();
  const conversation = await getConversation(id, user.id);

  if (!conversation) notFound();

  const messages = await getMessages(id);

  return <ChatView conversation={conversation} initialMessages={messages} />;
}
