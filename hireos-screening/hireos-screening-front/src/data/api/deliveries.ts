import { db } from "../db";
import type { Delivery } from "../fixtures/deliveries";
import { apiFetch } from "./shared";

export async function listDeliveries(): Promise<Delivery[]> {
  const deliveries = await apiFetch<Delivery[]>("/deliveries");
  for (const delivery of deliveries) {
    replaceDelivery(delivery);
    await hydrateApplication(delivery.applicationId);
  }
  return deliveries;
}

export async function getDelivery(id: string): Promise<Delivery> {
  const delivery = await apiFetch<Delivery>(`/deliveries/${id}`);
  replaceDelivery(delivery);
  await hydrateApplication(delivery.applicationId);
  return delivery;
}

/** Staged async send — mirrors the prototype's simulated delivery state
 * machine (queued → submitted → delivered/awaiting_confirmation). Retrying a
 * failed item only redelivers; it never re-runs the evaluation, link, or
 * invitation behind it. */
export async function sendDelivery(id: string): Promise<Delivery> {
  const delivery = await apiFetch<Delivery>(`/deliveries/${id}/send`, { method: "POST" });
  replaceDelivery(delivery);
  return delivery;
}

export async function retryDelivery(id: string): Promise<Delivery> {
  const delivery = await apiFetch<Delivery>(`/deliveries/${id}/retry`, { method: "POST" });
  replaceDelivery(delivery);
  return delivery;
}

export async function downloadDelivery(id: string): Promise<{ fileName: string }> {
  return apiFetch<{ fileName: string }>(`/deliveries/${id}/download`, { method: "POST" });
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
