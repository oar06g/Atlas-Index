import { Suspense } from 'react';
import SearchClient from './SearchClient';

function SearchSkeleton() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#121212]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6"
            >
              <div className="h-6 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-4" />
              <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-900 rounded animate-pulse mb-2" />
              <div className="h-4 w-5/6 bg-neutral-100 dark:bg-neutral-900 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchClient />
    </Suspense>
  );
}
