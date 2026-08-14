/**
 * haptics.js — Haptic Feedback Engine for Visually Impaired Users
 * ================================================================
 * Provides physical vibration patterns via `navigator.vibrate` to guide
 * blind readers during camera alignment, focus, scan success, and errors.
 */

/**
 * Check if the browser device supports the Haptic Vibration API.
 * @returns {boolean}
 */
export function isHapticsSupported() {
  return typeof window !== "undefined" && "navigator" in window && typeof window.navigator.vibrate === "function";
}

/**
 * Trigger a tactile vibration pattern safely.
 * @param {number|number[]} pattern - Vibration duration or pattern array in ms
 */
export function vibratePattern(pattern) {
  if (isHapticsSupported()) {
    try {
      window.navigator.vibrate(pattern);
    } catch (e) {
      // Ignore vibration permissions error on un-invoked gestures
    }
  }
}

/**
 * Short double-pulse for successful page capture or OCR completion.
 */
export function vibrateSuccess() {
  vibratePattern([100, 50, 100]);
}

/**
 * Long warning pulse for camera blur, poor lighting, or scan failure.
 */
export function vibrateError() {
  vibratePattern([300, 100, 300]);
}

/**
 * Gentle single vibration tap for navigation, alignment guidance, or page turn.
 */
export function vibrateNotice() {
  vibratePattern(80);
}

export default {
  isHapticsSupported,
  vibratePattern,
  vibrateSuccess,
  vibrateError,
  vibrateNotice,
};
