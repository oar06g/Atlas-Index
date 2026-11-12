

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-[#fafafa] p-4 pt-24 dark:bg-[#121212] sm:pt-4">
      <nav
        aria-label="Main actions"
        className="absolute right-4 top-5 flex flex-wrap justify-end gap-2 sm:right-6 sm:top-6 sm:gap-3"
      >
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-[#1e1e1e] dark:text-neutral-300 sm:px-4"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .8v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.8l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.8-3H4a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .8-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.8V2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .8l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .8 3h.2a1.8 1.8 0 1 1 0 3.6H20a1.8 1.8 0 0 0-.6 2.9Z"
            />
          </svg>
          <span>Settings</span>
        </button>

        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-[#1e1e1e] dark:text-neutral-300 sm:px-4"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12h3l3-8 5 16 3-8h4"
            />
          </svg>
          <span>System Status</span>
          <span
            aria-label="Checking services"
            className="h-2 w-2 animate-pulse rounded-full bg-yellow-500"
          />
        </button>

        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full bg-neutral-900 px-3 text-sm font-medium text-neutral-50 shadow-sm dark:bg-neutral-50 dark:text-neutral-900 sm:px-4"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
          <span>New Entry</span>
        </button>
      </nav>

      <section className="flex w-full max-w-[584px] flex-col items-center gap-4">
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Local Knowledge Assistant
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Search your local data and files completely offline
          </p>
        </header>

        <div className="flex w-full flex-col items-center gap-4">
          <div className="flex h-[50px] w-full items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 shadow-sm dark:border-neutral-800 dark:bg-[#1e1e1e]">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5 shrink-0 text-neutral-400"
            >
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path strokeLinecap="round" d="m16 16 4.5 4.5" />
            </svg>

            <input
              type="text"
              aria-label="Search local data"
              placeholder="Ask a question or search here..."
              className="min-w-0 flex-grow bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />

            <button
              type="button"
              disabled
              className="flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-400 opacity-60 dark:border-neutral-800 dark:text-neutral-500"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-3.5 w-3.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
                />
              </svg>
              <span>Add File</span>
            </button>
          </div>

          <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-full bg-neutral-900 px-6 text-sm font-medium text-neutral-50 shadow transition-colors dark:bg-neutral-50 dark:text-neutral-900"
          >
            <span>Search</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </section>
    </main>
  );
}
