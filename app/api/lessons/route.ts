import { fail } from "@/lib/api-errors";
import { deleteLessonsApi } from "@/lib/lesson-api";
import { getStorage } from "@/lib/server/storage";
import { SupabaseStorageError } from "@/lib/storage-supabase";

/** Массовое удаление занятий: тело { editIds: [...] }. Только для ментора. */
export async function DELETE(request: Request) {
  try {
    return await deleteLessonsApi(request, { storage: getStorage(), env: process.env });
  } catch (error) {
    if (error instanceof SupabaseStorageError) return fail(error.message, 503);
    throw error;
  }
}
