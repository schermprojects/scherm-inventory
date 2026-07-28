"use client";

import {
  Check,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SearchableSelectProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  allowCustomValue?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
};

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Digite ou selecione uma opção",
  emptyMessage = "Nenhuma opção encontrada.",
  allowCustomValue = true,
  disabled = false,
  className = "",
  id,
  name,
}: SearchableSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [highlightedIndex, setHighlightedIndex] =
    useState(-1);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);

        if (!allowCustomValue) {
          setSearch(value);
        }
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, [allowCustomValue, value]);

  const normalizedOptions = useMemo(() => {
    return Array.from(
      new Set(
        options
          .map((option) => option.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) =>
      a.localeCompare(b, "pt-BR", {
        sensitivity: "base",
      }),
    );
  }, [options]);

  const filteredOptions = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLocaleLowerCase("pt-BR");

    if (!normalizedSearch) {
      return normalizedOptions;
    }

    return normalizedOptions.filter((option) =>
      option
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch),
    );
  }, [normalizedOptions, search]);

  const exactMatch = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLocaleLowerCase("pt-BR");

    return normalizedOptions.some(
      (option) =>
        option.toLocaleLowerCase("pt-BR") ===
        normalizedSearch,
    );
  }, [normalizedOptions, search]);

  const canUseCustomValue =
    allowCustomValue &&
    search.trim().length > 0 &&
    !exactMatch;

  const selectableItems = [
    ...filteredOptions,
    ...(canUseCustomValue
      ? [`__custom__:${search.trim()}`]
      : []),
  ];

  function selectValue(nextValue: string) {
    const finalValue = nextValue.startsWith(
      "__custom__:",
    )
      ? nextValue.replace("__custom__:", "")
      : nextValue;

    setSearch(finalValue);
    onChange(finalValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  }

  function clearValue() {
    setSearch("");
    onChange("");
    setHighlightedIndex(-1);
    inputRef.current?.focus();
    setIsOpen(true);
  }

  function handleInputChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const nextValue = event.target.value;

    setSearch(nextValue);
    setHighlightedIndex(-1);
    setIsOpen(true);

    if (allowCustomValue) {
      onChange(nextValue);
    }
  }

  function handleInputFocus() {
    if (!disabled) {
      setIsOpen(true);
    }
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!isOpen) {
        setIsOpen(true);
      }

      setHighlightedIndex((current) => {
        const nextIndex = current + 1;

        return nextIndex >= selectableItems.length
          ? 0
          : nextIndex;
      });

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        setIsOpen(true);
      }

      setHighlightedIndex((current) => {
        const previousIndex = current - 1;

        return previousIndex < 0
          ? selectableItems.length - 1
          : previousIndex;
      });

      return;
    }

    if (event.key === "Enter") {
      if (!isOpen) {
        setIsOpen(true);
        return;
      }

      event.preventDefault();

      if (
        highlightedIndex >= 0 &&
        selectableItems[highlightedIndex]
      ) {
        selectValue(
          selectableItems[highlightedIndex],
        );

        return;
      }

      const firstOption = filteredOptions[0];

      if (
        firstOption &&
        filteredOptions.length === 1
      ) {
        selectValue(firstOption);
        return;
      }

      if (canUseCustomValue) {
        selectValue(`__custom__:${search.trim()}`);
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
      setSearch(value);
      inputRef.current?.blur();
    }

    if (event.key === "Tab") {
      setIsOpen(false);
      setHighlightedIndex(-1);

      if (allowCustomValue) {
        const trimmedValue = search.trim();

        setSearch(trimmedValue);
        onChange(trimmedValue);
      } else {
        setSearch(value);
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
    >
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          value={search}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={`${id ?? name ?? "searchable-select"}-listbox`}
          aria-autocomplete="list"
          onFocus={handleInputFocus}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-16 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:ring-2 focus:ring-[#F57B00]/15 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
        />

        {search ? (
          <button
            type="button"
            onClick={clearValue}
            disabled={disabled}
            aria-label="Limpar campo"
            className="absolute right-8 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed"
          >
            <X size={15} />
          </button>
        ) : null}

        <button
          type="button"
          disabled={disabled}
          aria-label={
            isOpen ? "Fechar opções" : "Abrir opções"
          }
          onClick={() => {
            setIsOpen((current) => !current);
            inputRef.current?.focus();
          }}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed"
        >
          <ChevronDown
            size={16}
            className={
              isOpen
                ? "rotate-180 transition-transform"
                : "transition-transform"
            }
          />
        </button>
      </div>

      {isOpen && !disabled ? (
        <div
          id={`${id ?? name ?? "searchable-select"}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-xl"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isSelected =
                option.toLocaleLowerCase("pt-BR") ===
                value
                  .trim()
                  .toLocaleLowerCase("pt-BR");

              const isHighlighted =
                index === highlightedIndex;

              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() =>
                    setHighlightedIndex(index)
                  }
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectValue(option);
                  }}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition",
                    isHighlighted
                      ? "bg-orange-50 text-[#D96D00]"
                      : "text-zinc-700 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <span className="truncate">
                    {option}
                  </span>

                  {isSelected ? (
                    <Check
                      size={16}
                      className="shrink-0 text-[#F57B00]"
                    />
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3 text-sm text-zinc-500">
              {emptyMessage}
            </div>
          )}

          {canUseCustomValue ? (
            <>
              {filteredOptions.length > 0 ? (
                <div className="my-1 border-t border-zinc-100" />
              ) : null}

              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseEnter={() =>
                  setHighlightedIndex(
                    filteredOptions.length,
                  )
                }
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectValue(
                    `__custom__:${search.trim()}`,
                  );
                }}
                className={[
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition",
                  highlightedIndex ===
                  filteredOptions.length
                    ? "bg-orange-50 text-[#D96D00]"
                    : "text-[#D96D00] hover:bg-orange-50",
                ].join(" ")}
              >
                Usar “{search.trim()}”
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}