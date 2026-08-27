"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createConversation,
  deleteConversation,
  getOrCreateDemoUser,
} from "@/db/queries";

export async function createConversationAction() {
  const user = await getOrCreateDemoUser();
  const conversation = await createConversation(user.id);
  revalidatePath("/");
  redirect(`/conversations/${conversation.id}`);
}

export async function deleteConversationAction(id: string) {
  const user = await getOrCreateDemoUser();
  await deleteConversation(id, user.id);
  revalidatePath("/");
  redirect("/");
}
