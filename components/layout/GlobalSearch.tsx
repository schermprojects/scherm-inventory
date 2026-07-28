"use client";

import {
  Boxes,
  FolderKanban,
  LoaderCircle,
  Search,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type SearchResultType =
  | "equipment"
  | "project"
  | "user";

type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  href: string;
};

type SearchApiResponse = {
  success: boolean;
  message?: string;
  results: SearchResult[];
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_DELAY = 300;

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();

  const containerRef =
    useRef<HTMLDivElement>(null);

  const inputRef =
    useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    SearchResult[]
  >([]);
  const [isLoading, setIsLoading] =
    useState(false);
  const [isOpen, setIsOpen] =
    useState(false);
  const [error, setError] = useState<
    string | null
  >(null);
  const [activeIndex, setActiveIndex] =
    useState(-1);

  useEffect(() => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setError(null);
    setActiveIndex(-1);
  }, [pathname]);

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  useEffect(() => {
    function handleShortcut(
      event: globalThis.KeyboardEvent,
    ) {
      const isSearchShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k";

      if (isSearchShortcut) {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }

    window.addEventListener(
      "keydown",
      handleShortcut,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleShortcut,
      );
    };
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (
      normalizedQuery.length <
      MIN_QUERY_LENGTH
    ) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      setActiveIndex(-1);

      return;
    }

    const abortController =
      new AbortController();

    const timer = window.setTimeout(
      async () => {
        setIsLoading(true);
        setError(null);

        try {
          const response = await fetch(
            `/api/search?q=${encodeURIComponent(
              normalizedQuery,
            )}`,
            {
              signal: abortController.signal,
            },
          );

          const data =
            (await response.json()) as SearchApiResponse;

          if (!response.ok || !data.success) {
            throw new Error(
              data.message ??
                "Não foi possível realizar a pesquisa.",
            );
          }

          setResults(data.results);
          setActiveIndex(-1);
          setIsOpen(true);
        } catch (requestError) {
          if (
            requestError instanceof DOMException &&
            requestError.name === "AbortError"
          ) {
            return;
          }

          setResults([]);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Não foi possível realizar a pesquisa.",
          );
          setIsOpen(true);
        } finally {
          if (
            !abortController.signal.aborted
          ) {
            setIsLoading(false);
          }
        }
      },
      DEBOUNCE_DELAY,
    );

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [query]);

  function handleChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setQuery(event.target.value);
    setIsOpen(true);
    setError(null);
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setError(null);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function selectResult(
    result: SearchResult,
  ) {
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(result.href);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      setActiveIndex((current) =>
        current >= results.length - 1
          ? 0
          : current + 1,
      );

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setActiveIndex((current) =>
        current <= 0
          ? results.length - 1
          : current - 1,
      );

      return;
    }

    if (
      event.key === "Enter" &&
      activeIndex >= 0
    ) {
      event.preventDefault();
      selectResult(results[activeIndex]);
    }
  }

  const normalizedQuery = query.trim();

  const shouldShowDropdown =
    isOpen &&
    (normalizedQuery.length >=
      MIN_QUERY_LENGTH ||
      Boolean(error));

  return (
    <div
      ref={containerRef}
      className="relative hidden md:block"
    >
      <Search
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-zinc-400"
      />

      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleChange}
        onFocus={() => {
          if (
            normalizedQuery.length >=
            MIN_QUERY_LENGTH
          ) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder="Buscar equipamentos, projetos..."
        aria-label="Buscar equipamentos, projetos e usuários"
        aria-expanded={shouldShowDropdown}
        aria-controls="global-search-results"
        autoComplete="off"
        className="h-10 w-80 rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-20 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#F57B00] focus:bg-white focus:ring-2 focus:ring-[#F57B00]/15 xl:w-96"
      />

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {isLoading ? (
          <LoaderCircle
            size={16}
            className="animate-spin text-[#F57B00]"
          />
        ) : null}

        {query ? (
          <button
            type="button"
            onClick={clearSearch}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700"
            aria-label="Limpar pesquisa"
          >
            <X size={15} />
          </button>
        ) : (
          <kbd className="hidden rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 xl:block">
            Ctrl K
          </kbd>
        )}
      </div>

      {shouldShowDropdown ? (
        <div
          id="global-search-results"
          className="absolute left-0 top-12 z-50 w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
        >
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Pesquisa global
            </p>
          </div>

          {error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold text-red-600">
                Não foi possível pesquisar
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                {error}
              </p>
            </div>
          ) : isLoading &&
            results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-zinc-500">
              <LoaderCircle
                size={18}
                className="animate-spin text-[#F57B00]"
              />
              Pesquisando...
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-[420px] overflow-y-auto p-2">
              {results.map((result, index) => (
                <Link
                  key={`${result.type}-${result.id}`}
                  href={result.href}
                  onClick={() => {
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => {
                    setActiveIndex(index);
                  }}
                  className={[
                    "flex items-start gap-3 rounded-lg px-3 py-3 transition",
                    activeIndex === index
                      ? "bg-orange-50"
                      : "hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <SearchResultIcon
                    type={result.type}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {result.title}
                      </p>

                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        {getTypeLabel(
                          result.type,
                        )}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {result.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <Search
                size={28}
                className="mx-auto text-zinc-300"
              />

              <p className="mt-3 text-sm font-semibold text-zinc-700">
                Nenhum resultado encontrado
              </p>

              <p className="mt-1 text-xs text-zinc-400">
                Tente pesquisar por outro nome,
                categoria ou número de série.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 px-4 py-2 text-[10px] text-zinc-400">
            <span>
              ↑ ↓ para navegar
            </span>

            <span>
              Enter para abrir · Esc para fechar
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchResultIcon({
  type,
}: {
  type: SearchResultType;
}) {
  const styles: Record<
    SearchResultType,
    string
  > = {
    equipment:
      "bg-orange-50 text-[#F57B00]",
    project: "bg-blue-50 text-blue-600",
    user: "bg-violet-50 text-violet-600",
  };

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles[type]}`}
    >
      {type === "equipment" ? (
        <Boxes size={18} />
      ) : type === "project" ? (
        <FolderKanban size={18} />
      ) : (
        <UserRound size={18} />
      )}
    </div>
  );
}

function getTypeLabel(
  type: SearchResultType,
) {
  const labels: Record<
    SearchResultType,
    string
  > = {
    equipment: "Equipamento",
    project: "Projeto",
    user: "Usuário",
  };

  return labels[type];
}