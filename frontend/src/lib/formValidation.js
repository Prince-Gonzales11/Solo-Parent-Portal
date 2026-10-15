/**
 * Form Validation and Auto-Focus / Smooth-Scroll Utilities
 * 
 * Provides consistent behavior across all user-side forms:
 * 1. Highlights missing required fields with a red border/ring.
 * 2. Displays clear inline error messages.
 * 3. Automatically scrolls to and focuses the first missing field.
 */

export const ERROR_INPUT_CLASS =
  'border-destructive ring-1 ring-destructive focus-visible:ring-destructive focus-visible:border-destructive';

export const ERROR_SELECT_CLASS =
  'border-destructive ring-1 ring-destructive focus:ring-destructive focus:border-destructive';

/**
 * Smoothly scrolls the viewport to the target field and focuses the input.
 * Supports field ID, name, data-field attribute, or direct HTMLElement.
 *
 * @param {string|HTMLElement} target - ID, selector, or element to scroll and focus
 * @param {object} [options]
 * @param {number} [options.delay=100] - Delay in ms before focusing (to allow rendering/animations)
 * @param {ScrollLogicalPosition} [options.block='center'] - Scroll alignment
 * @returns {boolean} Whether an element was found and focused
 */
export function scrollToAndFocus(target, { delay = 120, block = 'center' } = {}) {
  if (!target) return false;

  let el = null;
  if (typeof target === 'string') {
    // Try multiple selector patterns in order of specificity
    el =
      document.getElementById(target) ||
      document.querySelector(`[data-field="${target}"]`) ||
      document.querySelector(`[name="${target}"]`) ||
      document.getElementById(`field-${target}`) ||
      document.getElementById(`input-${target}`) ||
      document.querySelector(`.${target}`) ||
      document.querySelector(`[aria-labelledby="${target}"]`);
  } else if (target instanceof HTMLElement) {
    el = target;
  }

  if (!el) {
    return false;
  }

  // Scroll into view with smooth behavior
  try {
    el.scrollIntoView({ behavior: 'smooth', block });
  } catch {
    // Fallback if scrollIntoView options not supported
    el.scrollIntoView(true);
  }

  // Focus the element after a short delay for smooth scroll initiation
  setTimeout(() => {
    // If the element itself is focusable (input, textarea, select, button)
    let focusedNode = null;
    if (typeof el.focus === 'function' && isFocusable(el)) {
      el.focus({ preventScroll: true });
      focusedNode = el;
    } else {
      // Find the first focusable child (e.g. within a SelectTrigger, FieldWrapper, or Custom Card)
      const focusableChild = el.querySelector(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex="0"]'
      );
      if (focusableChild && typeof focusableChild.focus === 'function') {
        focusableChild.focus({ preventScroll: true });
        focusedNode = focusableChild;
      } else if (typeof el.focus === 'function') {
        el.setAttribute('tabindex', '-1');
        el.focus({ preventScroll: true });
        focusedNode = el;
      }
    }

    // High-visibility animated pulse ring to highlight missing field
    const targetToHighlight = focusedNode || el;
    targetToHighlight.classList.add('ring-4', 'ring-amber-500/60', 'dark:ring-amber-400/60', 'transition-all', 'duration-300', 'rounded-xl');
    setTimeout(() => {
      targetToHighlight.classList.remove('ring-4', 'ring-amber-500/60', 'dark:ring-amber-400/60');
    }, 3200);
  }, delay);

  return true;
}

function isFocusable(element) {
  if (!element || element.disabled) return false;
  const tagName = element.tagName.toLowerCase();
  return (
    ['input', 'select', 'textarea', 'button'].includes(tagName) ||
    element.hasAttribute('tabindex')
  );
}
