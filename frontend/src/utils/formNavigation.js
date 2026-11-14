import { useEffect } from 'react';

const NAVIGABLE_FIELDS_SELECTOR = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]):not([disabled]):not([readonly])',
  'select:not([disabled])',
  'textarea:not([disabled]):not([readonly])',
].join(',');

function isVisibleElement(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getNavigableFields(form) {
  return Array.from(form.querySelectorAll(NAVIGABLE_FIELDS_SELECTOR)).filter(isVisibleElement);
}

function focusAndSelectIfTextual(field) {
  field.focus();
  if (!(field instanceof HTMLInputElement)) return;
  const type = String(field.type || '').toLowerCase();
  if (['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(type)) {
    field.select();
  }
}

export function useGlobalFormEnterNavigation() {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.key !== 'Enter') return;
      if (event.isComposing || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.isContentEditable) return;
      if (target.tagName === 'BUTTON') return;

      const form = target.closest('form');
      if (!(form instanceof HTMLFormElement)) return;

      const fields = getNavigableFields(form);
      if (!fields.length) return;

      const currentIndex = fields.indexOf(target);
      if (currentIndex === -1) return;

      event.preventDefault();

      if (currentIndex < fields.length - 1) {
        const nextField = fields[currentIndex + 1];
        if (nextField instanceof HTMLElement) {
          focusAndSelectIfTextual(nextField);
        }
        return;
      }

      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);
}

export function usePreventNumberInputWheelChange() {
  useEffect(() => {
    const onWheel = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'number') return;
      if (document.activeElement !== target) return;

      // Prevent accidental value changes from mouse wheel.
      target.blur();
    };

    document.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => document.removeEventListener('wheel', onWheel, { capture: true });
  }, []);
}
