'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Calendar, FolderOpen, Tags, Type, Loader2 } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface KnowledgeEntry {
  id: string
  title: string
  slug: string
  content: string
  summary: string
  type: string
  category: string | null
  category_name: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export default function EntryViewer() {
  const params = useParams()
  const [data, setData] = useState<KnowledgeEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params.slug) return

    async function fetchEntry() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/entries/${params.slug}`)

        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Entry not found' : 'Failed to fetch entry')
        }

        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchEntry()
  }, [params.slug])

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#121212] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-neutral-600 dark:text-neutral-400 animate-spin" />
          <p className="text-neutral-600 dark:text-neutral-400">Loading entry...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#121212] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
            <Type className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Entry Not Found
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {error || "The requested knowledge entry doesn't exist or has been removed."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-neutral-900 dark:bg-neutral-50 text-neutral-50 dark:text-neutral-900 rounded-lg font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#121212]">
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-50 mb-4 leading-tight">
            {data.title}
          </h1>

          <div className="flex flex-wrap gap-4 text-sm text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 pb-6">
            {data.type && (
              <div className="flex items-center gap-1.5">
                <Type className="w-4 h-4" />
                <span className="capitalize">{data.type}</span>
              </div>
            )}
            {data.category_name && (
              <div className="flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4" />
                <span>{data.category_name}</span>
              </div>
            )}
            {data.created_at && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(data.created_at)}</span>
              </div>
            )}
          </div>
        </div>

        {data.summary && (
          <div className="mb-8 p-5 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl border-l-4 border-neutral-400 dark:border-neutral-600">
            <p className="text-neutral-700 dark:text-neutral-300 italic leading-relaxed">
              {data.summary}
            </p>
          </div>
        )}

        <div className="prose prose-neutral dark:prose-invert prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none max-w-none mb-12">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const code = String(children).replace(/\n$/, '')
                if (match) {
                  return (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                    >
                      {code}
                    </SyntaxHighlighter>
                  )
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
            }}
          >
            {data.content}
          </ReactMarkdown>
        </div>

        {data.tags && data.tags.length > 0 && (
          <div className="border-t border-neutral-200 dark:border-neutral-800 pt-6 mt-8">
            <div className="flex items-start gap-3">
              <Tags className="w-5 h-5 text-neutral-500 dark:text-neutral-400 mt-0.5" />
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-full text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-neutral-200 dark:border-neutral-800 mt-12 pt-6 text-center">
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Last updated: {formatDate(data.updated_at || data.created_at)}
          </p>
        </div>
      </div>
    </div>
  )
}
