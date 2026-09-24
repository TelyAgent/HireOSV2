import { db } from "../db";
import type { AiModelsData } from "../fixtures/aiModels";
import { delay } from "./shared";
import { apiFetch, isRealApi } from "./shared";

export async function getAiModels(): Promise<AiModelsData> {
  if (isRealApi()) return apiFetch<AiModelsData>("/ai-models");
  await delay();
  return db.aiModels;
}
