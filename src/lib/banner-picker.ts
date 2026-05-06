// Pure state-machine helpers for the Header picker screen (PR 1b).
//
// The picker holds a draft (bannerType + bannerValue + optional selected
// film for BACKDROP, or picked photo for PHOTO) and compares it to the
// persisted state to decide whether Save is enabled. Switching segmented
// tabs resets the draft to the persisted state in the new tab; selecting
// a film in BACKDROP mode updates the draft. These transitions are
// extracted here so they can be unit tested without rendering the screen.
//
// PHOTO mode landed in mobile prompt 3. The Save handler does a multi-step
// flow (crop -> upload -> PATCH) that lives in header-picker.tsx itself;
// this file only owns the cover-fit + clamp + crop math.

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

// Returns true when the user has made a change worth saving in the active
// tab. For PHOTO, the picker manages its own gating on top of this (Save
// is only enabled while a photo is picked AND no upload is in progress);
// the type-level check here is whether the draft differs from persisted.
//
// Special case: when activeTab is PHOTO and the draft equals persisted
// (no photo picked yet), Save is disabled. This is naturally handled by
// the equality check since draftBannerValue stays at the persisted value
// until a photo is picked.
export function isSaveEnabled(
  draft: PickerDraft,
  persisted: PickerPersisted,
  activeTab: PickerTab,
): boolean {
  if (activeTab === 'PHOTO') {
    // Save is only meaningful in PHOTO mode once draft.bannerType has
    // flipped to PHOTO (which the picker does after a photo is picked).
    // The picker also defers Save until upload completes; that gate is
    // applied at the call site in header-picker.tsx.
    return draft.bannerType === 'PHOTO';
  }
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
// Photo state (pickedPhoto, panOffset) is held outside PickerState in the
// header-picker screen and cleared by the same tab-switch handler.
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

// ---------------------------------------------------------------------------
// Photo crop math (PR 1b mobile prompt 3)
// ---------------------------------------------------------------------------

export interface PhotoCropInput {
  photoWidth: number;
  photoHeight: number;
  frameWidth: number;
  frameHeight: number;
  panX: number;
  panY: number;
}

export interface PhotoRender {
  // Cover-fit dimensions of the photo as it sits inside the 16:9 frame.
  // The shorter dimension matches the frame; the longer overflows.
  renderedWidth: number;
  renderedHeight: number;
  // Pan translation clamped so the photo's edges never reveal frame
  // background. clampedPanX in [-maxPanX, maxPanX], same for Y.
  clampedPanX: number;
  clampedPanY: number;
  // Maximum pan magnitudes in screen points. Useful to surface to the
  // gesture handler (or to detect "no panning possible" when both are 0).
  maxPanX: number;
  maxPanY: number;
}

// Cover-fit a photo inside a frame and clamp a proposed pan translation.
// Cover-fit semantics: scale the photo so the shorter dimension matches
// the frame, the longer overflows. The pan moves the rendered photo over
// the frame; clamping keeps the photo edges flush with or beyond the
// frame edges (no background showing through).
//
// Defensive: degenerate inputs (zero or negative dimensions) return
// renderedWidth/Height = frame dims and zero clamped pan, matching the
// "nothing to render" interpretation. The picker never feeds these in
// practice (expo-image-picker returns positive native dimensions), but
// guarding keeps the math from producing NaN.
export function computePhotoCrop(input: PhotoCropInput): PhotoRender {
  const { photoWidth, photoHeight, frameWidth, frameHeight, panX, panY } = input;
  if (
    photoWidth <= 0 ||
    photoHeight <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    return {
      renderedWidth: Math.max(0, frameWidth),
      renderedHeight: Math.max(0, frameHeight),
      clampedPanX: 0,
      clampedPanY: 0,
      maxPanX: 0,
      maxPanY: 0,
    };
  }
  const frameAspect = frameWidth / frameHeight;
  const photoAspect = photoWidth / photoHeight;
  let renderedWidth: number;
  let renderedHeight: number;
  if (photoAspect > frameAspect) {
    // Photo wider than frame relative to its height: match heights, photo
    // overflows horizontally.
    renderedHeight = frameHeight;
    renderedWidth = frameHeight * photoAspect;
  } else {
    // Photo taller (or equal): match widths, photo overflows vertically
    // (or fits exactly when aspects match).
    renderedWidth = frameWidth;
    renderedHeight = frameWidth / photoAspect;
  }
  const maxPanX = Math.max(0, (renderedWidth - frameWidth) / 2);
  const maxPanY = Math.max(0, (renderedHeight - frameHeight) / 2);
  return {
    renderedWidth,
    renderedHeight,
    clampedPanX: clamp(panX, -maxPanX, maxPanX),
    clampedPanY: clamp(panY, -maxPanY, maxPanY),
    maxPanX,
    maxPanY,
  };
}

export interface SourceCropRect {
  // Rectangle in original photo pixel coordinates. Pass to
  // expo-image-manipulator's crop action verbatim.
  originX: number;
  originY: number;
  width: number;
  height: number;
}

// Translate the visible region of the cover-fit + panned photo from
// rendered (screen point) coordinates back to original photo pixel
// coordinates, ready for expo-image-manipulator's crop action.
//
// Derivation: the cover-fit photo, centered with no pan, has its top-left
// at (-(renderedWidth-frameWidth)/2, -(renderedHeight-frameHeight)/2) in
// frame-local screen coordinates. With pan (panX, panY) the photo shifts
// by that vector, so the top-left of the visible region in rendered-photo
// coordinates is ((renderedWidth-frameWidth)/2 - panX, ...). Divide by
// scaleFactor to get original photo pixel coordinates.
//
// scaleFactor is the cover-fit scale (renderedDim / photoDim, equal on
// both axes by construction).
export function computeSourceCropRect(input: PhotoCropInput): SourceCropRect {
  const { photoWidth, photoHeight, frameWidth, frameHeight } = input;
  const render = computePhotoCrop(input);
  if (
    photoWidth <= 0 ||
    photoHeight <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    return { originX: 0, originY: 0, width: 0, height: 0 };
  }
  // Use the matched dimension to derive scaleFactor. Both axes' ratios
  // equal the cover-fit scale by construction, so either works; we pick
  // the one that's exactly frame-matched to avoid floating-point drift.
  const scaleFactor =
    render.renderedWidth === frameWidth
      ? frameWidth / photoWidth
      : frameHeight / photoHeight;
  const originX =
    ((render.renderedWidth - frameWidth) / 2 - render.clampedPanX) / scaleFactor;
  const originY =
    ((render.renderedHeight - frameHeight) / 2 - render.clampedPanY) / scaleFactor;
  const width = frameWidth / scaleFactor;
  const height = frameHeight / scaleFactor;
  return { originX, originY, width, height };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
