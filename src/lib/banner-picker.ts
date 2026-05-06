// Pure state-machine helpers for the Header picker screen (PR 1b).
//
// The picker holds a draft (bannerType + bannerValue + optional selected
// film for BACKDROP) and compares it to the persisted state to decide
// whether Save is enabled. Switching segmented tabs resets the draft to
// the persisted state in the new tab; selecting a film in BACKDROP mode
// updates the draft. These transitions are extracted here so they can be
// unit tested without rendering the screen.
//
// PHOTO is a placeholder in this prompt: tab is reachable, draft never
// changes, Save is always disabled in PHOTO mode. PHOTO content lands in
// the next mobile prompt.

import type { BannerType } from './api';
import type { Film } from '../types/film';

export type PickerTab = 'GRADIENT' | 'BACKDROP' | 'PHOTO';

export interface PickerPersisted {
  bannerType: BannerType;
  bannerValue: string;
}

export interface PickerDraft {
  bannerType: BannerType;
  bannerValue: string;
  // Only meaningful in BACKDROP mode: the film whose backdrop is showing
  // in the preview right now. Held alongside the draft so the preview can
  // render without another fetch. null when no draft selection has been
  // made (e.g. immediately after a tab switch).
  selectedFilm: Film | null;
}

export interface PickerState extends PickerDraft {
  activeTab: PickerTab;
}

// Returns true when the user has made a change worth saving. PHOTO is
// always false in this prompt (placeholder tab, no upload UI yet).
export function isSaveEnabled(
  draft: PickerDraft,
  persisted: PickerPersisted,
  activeTab: PickerTab,
): boolean {
  if (activeTab === 'PHOTO') return false;
  return (
    draft.bannerType !== persisted.bannerType ||
    draft.bannerValue !== persisted.bannerValue
  );
}

// Compute the picker state after the user taps a different segmented tab.
// Per the locked contract, this always resets the draft back to whatever
// is currently persisted and clears any in-progress film selection. The
// only thing that changes is activeTab.
//
// Why reset on every tab switch (even Gradient -> Gradient): the call site
// only fires this when the tab actually changes, so this branch is moot
// for same-tab. Belt-and-suspenders, the function still does the right
// thing if the same tab is passed in.
export function getResetStateForTab(
  newTab: PickerTab,
  persisted: PickerPersisted,
): PickerState {
  return {
    activeTab: newTab,
    bannerType: persisted.bannerType,
    bannerValue: persisted.bannerValue,
    selectedFilm: null,
  };
}

// Compute the picker state after the user taps a film card in BACKDROP
// mode. Always sets bannerType to BACKDROP and bannerValue to the film
// id; activeTab is preserved (only film cards in the BACKDROP tab can
// trigger this, so activeTab will already be BACKDROP).
export function getStateAfterFilmSelection(
  state: PickerState,
  film: Film,
): PickerState {
  return {
    activeTab: state.activeTab,
    bannerType: 'BACKDROP',
    bannerValue: film.id,
    selectedFilm: film,
  };
}

// Initial picker state on mount: activeTab follows the persisted bannerType,
// draft starts equal to persisted. selectedFilm starts null because the
// caller has not fetched the persisted film record yet (Profile resolves
// it asynchronously and passes it down once available).
export function getInitialState(persisted: PickerPersisted): PickerState {
  return {
    activeTab: persisted.bannerType,
    bannerType: persisted.bannerType,
    bannerValue: persisted.bannerValue,
    selectedFilm: null,
  };
}
