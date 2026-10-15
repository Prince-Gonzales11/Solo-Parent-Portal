import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { ChevronDown, Check, X } from 'lucide-react';
import { ERROR_INPUT_CLASS } from '@/lib/formValidation';

/**
 * Normalizes text for flexible, case-insensitive, and punctuation-agnostic search.
 * e.g., "Baan KM 3" -> "baan km 3"
 *       "baan km.3" -> "baan km 3"
 *       "Agusan Pequeño" -> "agusan pequeno"
 */
export function normalizeSearch(text) {
  return (text ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .replace(/[.,\-_/()#'"&]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ')            // collapse consecutive whitespace
    .trim();
}

/**
 * Flexible matching: checks if label contains query, or if all query tokens appear in target.
 */
export function matchesSearchQuery(label, query, extra = '') {
  if (!query || !query.trim()) return true;
  const normTarget = normalizeSearch(`${label} ${extra}`);
  const normQuery = normalizeSearch(query);

  if (normTarget.includes(normQuery)) return true;

  const tokens = normQuery.split(' ').filter(Boolean);
  return tokens.every(tok => normTarget.includes(tok));
}

/**
 * Standardize an option item to { value, label, description, group, original }
 */
function toStandardOption(item) {
  if (typeof item === 'string' || typeof item === 'number') {
    return { value: String(item), label: String(item), original: item };
  }
  if (item && typeof item === 'object') {
    const value = item.value ?? item.name ?? item.code ?? item.id ?? '';
    const label = item.label ?? item.name ?? item.code ?? String(value);
    return {
      value: String(value),
      label: String(label),
      description: item.description || '',
      group: item.group || '',
      original: item,
    };
  }
  return { value: '', label: '', original: item };
}

/**
 * TypeableSelect (Combobox)
 * 
 * An input field that allows both free-form typing and choosing from a dropdown list.
 * Features:
 * - Real-time case-insensitive, punctuation-agnostic filtering (e.g., 'baan km.3' matches 'Baan KM 3')
 * - Full list display when opened or empty
 * - Section / group headers with sticky positioning
 * - Multi-line and descriptive options
 * - Retains custom typed text or selected option
 * - Accessible keyboard navigation & click-outside handling
 */
export function TypeableSelect({
  id,
  value = '',
  onChange,
  options = [],
  placeholder = 'Select or type...',
  required = false,
  disabled = false,
  error = false,
  className = '',
  allowCustom = true,
  emptyMessage = 'No matching options',
  icon: Icon,
  autoComplete = 'off',
  maxDropdownHeight = 'max-h-80',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options list
  const standardOptions = useMemo(() => {
    return (options || []).map(toStandardOption);
  }, [options]);

  // Keep query text in sync if external value changes (and user is not currently actively typing with open dropdown)
  useEffect(() => {
    if (!isOpen) {
      // Find matching option label if value is an id or code
      const matched = standardOptions.find(o => 
        o.value.toLowerCase() === String(value || '').toLowerCase() ||
        o.label.toLowerCase() === String(value || '').toLowerCase()
      );
      setQuery(matched ? matched.label : (value || ''));
    }
  }, [value, standardOptions, isOpen]);

  // Filter options based on typed query
  const filteredOptions = useMemo(() => {
    if (!query || !query.trim()) {
      return standardOptions;
    }
    return standardOptions.filter(opt =>
      matchesSearchQuery(opt.label, query, `${opt.value} ${opt.description || ''} ${opt.group || ''}`)
    );
  }, [standardOptions, query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
        // If not custom allowed and current query isn't in options, revert or clear
        if (!allowCustom) {
          const match = standardOptions.find(o => 
            normalizeSearch(o.label) === normalizeSearch(query) ||
            normalizeSearch(o.value) === normalizeSearch(query)
          );
          if (match) {
            onChange?.(match.value, match.original);
            setQuery(match.label);
          } else {
            onChange?.('', null);
            setQuery('');
          }
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [allowCustom, onChange, query, standardOptions]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIndex];
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    setHighlightedIndex(0);

    // Look for exact/normalized match
    const exactMatch = standardOptions.find(o => 
      normalizeSearch(o.label) === normalizeSearch(val) ||
      normalizeSearch(o.value) === normalizeSearch(val)
    );

    if (exactMatch) {
      onChange?.(exactMatch.value, exactMatch.original);
    } else if (allowCustom) {
      onChange?.(val, null);
    }
  };

  const selectOption = useCallback((option) => {
    setQuery(option.label);
    onChange?.(option.value, option.original);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, [onChange]);

  const handleClear = (e) => {
    e.stopPropagation();
    setQuery('');
    onChange?.('', null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(filteredOptions.length - 1);
      } else {
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        selectOption(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const isSelected = (opt) => {
    const normVal = normalizeSearch(value);
    return normVal === normalizeSearch(opt.value) || normVal === normalizeSearch(opt.label);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-30' : ''} ${className}`}>
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 pointer-events-none text-muted-foreground flex items-center">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`pr-16 ${Icon ? 'pl-9' : ''} ${error ? ERROR_INPUT_CLASS : ''}`}
          aria-expanded={isOpen}
          aria-invalid={error ? 'true' : undefined}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {query && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Clear"
              aria-label="Clear value"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setIsOpen(prev => !prev);
                inputRef.current?.focus();
              }
            }}
            disabled={disabled}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Toggle dropdown options"
            aria-label="Toggle options"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown */}
      {isOpen && !disabled && (
        <div 
          className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div
            ref={listRef}
            className={`${maxDropdownHeight} overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-muted-foreground/20`}
            role="listbox"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const active = isSelected(opt);
                const isHighlighted = highlightedIndex === idx;
                const prevOpt = filteredOptions[idx - 1];
                const showGroupHeader = opt.group && (!prevOpt || prevOpt.group !== opt.group);

                return (
                  <React.Fragment key={`${opt.value}-${idx}`}>
                    {showGroupHeader && (
                      <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary bg-muted/60 rounded-md my-1 sticky top-0 backdrop-blur-md z-10 select-none">
                        {opt.group}
                      </div>
                    )}
                    <div
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => {
                        // Prevent input blur before click executes
                        e.preventDefault();
                        selectOption(opt);
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                        isHighlighted ? 'bg-accent text-accent-foreground' : ''
                      } ${active ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-medium text-sm leading-snug break-words">
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="text-xs text-muted-foreground line-clamp-2 mt-0.5 font-normal">
                            {opt.description}
                          </span>
                        )}
                      </div>
                      {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  </React.Fragment>
                );
              })
            ) : (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                {emptyMessage}
                {allowCustom && query && (
                  <p className="mt-1 text-xs text-foreground font-medium">
                    Press Tab or click away to use &ldquo;{query}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TypeableSelect;
