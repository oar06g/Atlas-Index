'use client';

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ArrowLeft, Loader2, FolderOpen, Tag, Calendar, Type, AlertCircle } from "lucide-react";
import Link from "next/link";

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary: string;
  type: string;
  category: string;
  category_name: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  similarity?: number;
  relevance?: number;
}

export default function SearchClient() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    async function performSearch() {
      if (!query || query.trim().length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: query.trim() }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to perform search');
        }

        setResults(data.results || []);
        setTotalResults(data.total || 0);
        
      } catch (error) {
        console.error('Search error:', error);
        setError(error instanceof Error ? error.message : 'An error occurred during search');
        setResults([]);
        setTotalResults(0);
      } finally {
        setLoading(false);
      }
    }

    performSearch();
  }, [query]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;
    
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800/50 text-neutral-900 dark:text-neutral-100 px-0.5 rounded">
          {part}
        </mark> : 
        part
    );
  };

  const toPlainText = (markdown: string) => {
    return markdown
      .replace(/#{1,6}\\s/g, '')
      .replace(/\\*\\*(.*?)\\*\\*/g, '$1')
      .replace(/\\*(.*?)\\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/```[\\s\\S]*?```/g, '')
      .replace(/\\[(.*?)\\]\\(.*?\\)/g, '$1')
      .replace(/!\\[.*?\\]\\(.*?\\)/g, '')
      .replace(/^\\s*[-*+]\\s/gm, '')
      .replace(/^\\s*\\d+\\.\\s/gm, '')
      .replace(/>\\s/g, '')
      .slice(0, 200);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#121212]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
          
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-neutral-400 dark:text-neutral-600 animate-spin mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">Searching for &ldquo;{query}&rdquo;...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#121212]">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            
            <div className="flex items-center gap-2 text-sm bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-full">
              <Search className="w-4 h-4 text-neutral-500" />
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                {query}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Search Results
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Found {totalResults} result{totalResults === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Search Failed
            </h3>
            <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!error && !loading && results.length === 0 && query && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full mb-4">
              <Search className="w-10 h-10 text-neutral-400 dark:text-neutral-600" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              No results found
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              We couldn&rsquo;t find any matches for &ldquo;{query}&rdquo;. Try using different keywords or check your spelling.
            </p>
          </div>
        )}

        {!error && !loading && results.length > 0 && (
          <div className="space-y-4">
            {results.map((result) => (
              <Link
                key={result.id}
                href={`/entry/${result.slug}`}
                className="block group"
              >
                <div className="bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:border-neutral-300 dark:hover:border-neutral-700">
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
                    {highlightText(result.title, query || '')}
                  </h2>
                  
                  <div className="flex flex-wrap gap-3 mb-3 text-xs">
                    {result.type && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                        <Type className="w-3 h-3" />
                        <span className="capitalize">{result.type}</span>
                      </span>
                    )}
                    {result.category_name && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                        <FolderOpen className="w-3 h-3" />
                        {result.category_name}
                      </span>
                    )}
                    {result.created_at && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                        <Calendar className="w-3 h-3" />
                        {formatDate(result.created_at)}
                      </span>
                    )}
                    {result.similarity && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                        Match: {Math.round(result.similarity * 100)}%
                      </span>
                    )}
                  </div>
                  
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-3 line-clamp-3">
                    {result.summary 
                      ? highlightText(result.summary, query || '')
                      : highlightText(toPlainText(result.content), query || '')
                    }
                  </p>
                  
                  {result.tags && result.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {result.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                          <Tag className="w-3 h-3" />
                          #{tag}
                        </span>
                      ))}
                      {result.tags.length > 3 && (
                        <span className="text-xs text-neutral-400">+{result.tags.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
