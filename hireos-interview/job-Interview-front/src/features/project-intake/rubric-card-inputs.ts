import type { CardInput } from './api';

export function saveCardInputs(cards: CardInput[], draft: CardInput): CardInput[] {
  return draft.id
    ? cards.map(card => card.id === draft.id ? draft : card)
    : [...cards, draft];
}
