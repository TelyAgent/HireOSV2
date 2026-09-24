import { db } from "../db";
import type { Delivery } from "../fixtures/deliveries";
import { ApiError, apiFetch, delay, isRealApi } from "./shared";

export async function listDeliveries(): Promise<Delivery[]> {
  if (isRealApi()) {
    const deliveries = await apiFetch<Delivery[]>("/deliveries");
    for (const delivery of deliveries) {
      const index = db.deliveries.findIndex((item) => item.id === delivery.id);
      if (index >= 0) db.deliveries[index] = delivery;
      else db.deliveries.push(delivery);
      await hydrateApplication(delivery.applicationId);
    }
    return deliveries;
  }
  await delay();
  return [...db.deliveries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getDelivery(id: string): Promise<Delivery> {
  if (isRealApi()) {
    const delivery = await apiFetch<Delivery>(`/deliveries/${id}`);
    const index = db.deliveries.findIndex((item) => item.id === delivery.id);
    if (index >= 0) db.deliveries[index] = delivery;
    else db.deliveries.push(delivery);
    await hydrateApplication(delivery.applicationId);
    return delivery;
  }
  await delay();
  const delivery = db.deliveries.find((d) => d.id === id);
  if (!delivery) throw new ApiError("NOT_FOUND", `Delivery ${id} not found`);
  return delivery;
}

function findDelivery(id: string): Delivery {
  const delivery = db.deliveries.find((d) => d.id === id);
  if (!delivery) throw new ApiError("NOT_FOUND", `Delivery ${id} not found`);
  return delivery;
}

/** Staged async send — mirrors the prototype's simulated delivery state
 * machine (queued → submitted → delivered/awaiting_confirmation). Retrying a
 * failed item only redelivers; it never re-runs the evaluation, link, or
 * invitation behind it. */
export async function sendDelivery(id: string): Promise<Delivery> {
  if (isRealApi()) {
    const delivery = await apiFetch<Delivery>(`/deliveries/${id}/send`, { method: "POST" });
    replaceDelivery(delivery);
    return delivery;
  }
  const delivery = findDelivery(id);
  delivery.status = "queued";
  delivery.history.push({ at: new Date().toISOString(), state: "Queued" });
  await delay(500);
  delivery.status = "submitted";
  delivery.history.push({ at: new Date().toISOString(), state: "Submitted" });
  await delay(500);
  delivery.status = "awaiting_confirmation";
  delivery.history.push({ at: new Date().toISOString(), state: "Delivered (no receipt yet — awaiting confirmation)" });
  return delivery;
}

export async function retryDelivery(id: string): Promise<Delivery> {
  if (isRealApi()) {
    const delivery = await apiFetch<Delivery>(`/deliveries/${id}/retry`, { method: "POST" });
    replaceDelivery(delivery);
    return delivery;
  }
  const delivery = findDelivery(id);
  await delay(400);
  return sendDelivery(delivery.id);
}

export async function downloadDelivery(id: string): Promise<{ fileName: string }> {
  if (isRealApi()) {
    return apiFetch<{ fileName: string }>(`/deliveries/${id}/download`, { method: "POST" });
  }
  const delivery = findDelivery(id);
  await delay(500);
  return { fileName: `${delivery.id}-package.pdf` };
}

function replaceDelivery(delivery: Delivery) {
  const index = db.deliveries.findIndex((item) => item.id === delivery.id);
  if (index >= 0) db.deliveries[index] = delivery;
  else db.deliveries.push(delivery);
}

async function hydrateApplication(applicationId?: string) {
  if (!applicationId) return;
  try {
    const detail = await apiFetch<{
      application: (typeof db.applications)[number];
      evaluation: (typeof db.evaluations)[string] | null;
      concerns: (typeof db.concerns)[string];
    }>(`/applications/${applicationId}/screening`);
    const index = db.applications.findIndex((item) => item.id === detail.application.id);
    if (index >= 0) db.applications[index] = detail.application;
    else db.applications.push(detail.application);
    if (detail.evaluation) db.evaluations[applicationId] = detail.evaluation;
    db.concerns[applicationId] = detail.concerns;
  } catch {
    // Historical deliveries may not have a live application.
  }
}
