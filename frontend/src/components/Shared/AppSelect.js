import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiChevronDown, FiX } from 'react-icons/fi';

const MOBILE_TOUCH_QUERY = '(max-width: 768px) and (hover: none) and (pointer: coarse)';

function readText(content) {
  if (Array.isArray(content)) return content.map(readText).join('');
  if (React.isValidElement(content)) return readText(content.props?.children);
  if (typeof content === 'string' || typeof content === 'number') return String(content);
  return '';
}

function collectOptions(children, acc = []) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    if (child.type === React.Fragment) {
      collectOptions(child.props?.children, acc);
      return;
    }

    if (child.type === 'optgroup') {
      collectOptions(child.props?.children, acc);
      return;
    }

    if (child.type === 'option') {
      const rawValue = child.props?.value;
      const optionValue = rawValue !== undefined ? rawValue : readText(child.props?.children);
      const label = String(readText(child.props?.children) || optionValue || '').trim();
      acc.push({
        value: optionValue,
        label,
        disabled: !!child.props?.disabled,
      });
    }
  });
  return acc;
}

function useIsMobileTouch() {
  const getInitial = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(MOBILE_TOUCH_QUERY).matches;
  };

  const [isMobileTouch, setIsMobileTouch] = useState(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(MOBILE_TOUCH_QUERY);
    const onChange = (event) => setIsMobileTouch(event.matches);

    setIsMobileTouch(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  return isMobileTouch;
}

function toComparable(value) {
  return value === undefined || value === null ? '' : String(value);
}

export default function AppSelect({
  children,
  className = '',
  style,
  value,
  onChange,
  disabled = false,
  name,
  id,
  mobileTitle,
  ...rest
}) {
  const isMobileTouch = useIsMobileTouch();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => collectOptions(children, []), [children]);
  const comparableValue = toComparable(value);
  const selectedOption = options.find((option) => toComparable(option.value) === comparableValue);
  const selectedLabel = selectedOption?.label || '';
  const isDomAvailable = typeof document !== 'undefined';

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!isMobileTouch && open) setOpen(false);
  }, [isMobileTouch, open]);

  const emitChange = (nextValue) => {
    if (typeof onChange !== 'function') return;
    const normalized = toComparable(nextValue);
    onChange({
      type: 'change',
      target: { value: normalized, name },
      currentTarget: { value: normalized, name },
      preventDefault: () => {},
      stopPropagation: () => {},
    });
  };

  if (!isMobileTouch) {
    return (
      <select
        id={id}
        name={name}
        className={className}
        style={style}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...rest}
      >
        {children}
      </select>
    );
  }

  const title = mobileTitle || rest['aria-label'] || name || selectedLabel || 'Select';

  return (
    <>
      {name ? <input type="hidden" name={name} value={comparableValue} /> : null}
      <button
        type="button"
        id={id}
        className={`${className} app-select-trigger`}
        style={style}
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={rest['aria-label']}
      >
        <span className="app-select-trigger-value">{selectedLabel || '\u2014'}</span>
        <FiChevronDown className="app-select-trigger-icon" />
      </button>

      {open && isDomAvailable && createPortal(
        <div className="app-select-mobile-overlay" onClick={() => setOpen(false)}>
          <div
            className="app-select-mobile-sheet"
            role="listbox"
            aria-label={title}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-select-mobile-header">
              <div className="app-select-mobile-title">{title}</div>
              <button
                type="button"
                className="app-select-mobile-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>
            <div className="app-select-mobile-list">
              {options.map((option) => {
                const optionComparableValue = toComparable(option.value);
                const isActive = optionComparableValue === comparableValue;
                return (
                  <button
                    key={`${optionComparableValue}-${option.label}`}
                    type="button"
                    className={`app-select-mobile-option${isActive ? ' active' : ''}`}
                    onClick={() => {
                      emitChange(option.value);
                      setOpen(false);
                    }}
                    disabled={option.disabled}
                    role="option"
                    aria-selected={isActive}
                  >
                    <span>{option.label || optionComparableValue}</span>
                    {isActive ? <FiCheck /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
