import type { AiModelsData } from "../fixtures/aiModels";
import { apiFetch } from "./shared";

export async function getAiModels(): Promise<AiModelsData> {
  return apiFetch<AiModelsData>("/ai-models");
}
