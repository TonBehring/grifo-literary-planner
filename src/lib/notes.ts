import { addNote } from "@/lib/api";

export type NewNoteData = { content: string; kind: "nota" | "citacao"; page: string };

export function createBookNote(userBookId: string, userId: string, data: NewNoteData) {
  return addNote({
    user_book_id: userBookId,
    user_id: userId,
    content: data.content.slice(0, 2000),
    kind: data.kind,
    page: data.page ? Number(data.page) : null,
  });
}