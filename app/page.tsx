"use client";

import React, { useState, useRef, useEffect, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileUp, X, ArrowRight, Plus, Activity, Database, Cpu, CheckCircle, XCircle, RotateCw, AlertCircle } from 'lucide-react';

export default function AtlasIndex() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [systemStatus, setSystemStatus] = useState({
    database: { status: 'loading', code: 0 },
    ollama: { status: 'loading', code: 0 }
  });
  const [loadingStates, setLoadingStates] = useState({
    database: false,
    ollama: false
  });
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setSystemStatus(data);
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      setSystemStatus({
        database: { status: 'error', code: 500 },
        ollama: { status: 'error', code: 500 }
      });
    }
  };

  // Fetch system status on component mount
  useEffect(() => {
    startTransition(() => {
      fetchSystemStatus();
    });
  }, []);

  const fetchSingleServiceStatus = async (service: 'database' | 'ollama') => {
    setLoadingStates(prev => ({ ...prev, [service]: true }));
    
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setSystemStatus(prev => ({
        ...prev,
        [service]: data[service]
      }));
    } catch (error) {
      console.error(`Failed to fetch ${service} status:`, error);
      setSystemStatus(prev => ({
        ...prev,
        [service]: { status: 'error', code: 500 }
      }));
    } finally {
      setLoadingStates(prev => ({ ...prev, [service]: false }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    router.push(`/search?q=${query}`)
    setQuery('');
  };

  // Helper function to get status icon and color
  const getStatusDisplay = (service: { status: string; code: number }) => {
    switch(service.status) {
      case 'connected':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-500" />,
          text: 'Connected',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800'
        };
      case 'loading':
        return {
          icon: <Activity className="w-4 h-4 text-yellow-500 animate-pulse" />,
          text: 'Loading...',
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800'
        };
      case 'error':
        return {
          icon: <XCircle className="w-4 h-4 text-red-500" />,
          text: `Error (${service.code})`,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800'
        };
      default:
        return {
          icon: <AlertCircle className="w-4 h-4 text-gray-500" />,
          text: 'Unknown',
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-800'
        };
    }
  };

  const databaseStatus = getStatusDisplay(systemStatus.database);
  const ollamaStatus = getStatusDisplay(systemStatus.ollama);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#fafafa] dark:bg-[#121212] p-4 overflow-x-hidden">
      
      {/* Top Action Buttons (System Status & New Entry) */}
      <div className="absolute top-6 right-6 flex gap-3">
        {/* System Status Dropdown Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
            className="flex items-center gap-2 h-9 px-4 bg-white dark:bg-[#1e1e1e] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-medium rounded-full border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all active:scale-[0.98]"
          >
            <Activity className="w-4 h-4" />
            <span>System Status</span>
            {(systemStatus.database.status === 'connected' && systemStatus.ollama.status === 'connected') ? (
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            ) : (systemStatus.database.status === 'error' || systemStatus.ollama.status === 'error') ? (
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            )}
          </button>

          {/* Status Dropdown Menu */}
          {isStatusDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setIsStatusDropdownOpen(false)}
              />
              <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    System Services Status
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Real-time status of backend services
                  </p>
                </div>

                {/* Database Service */}
                <div className={`p-4 border-b border-neutral-100 dark:border-neutral-800 ${databaseStatus.bgColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-sm">
                        <Database className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                      </div>
                      <div>
                        <h4 className="font-medium text-neutral-900 dark:text-neutral-100">Database</h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">PostgreSQL / SQLite</p>
                      </div>
                    </div>
                    <button
                      onClick={() => fetchSingleServiceStatus('database')}
                      disabled={loadingStates.database}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCw className={`w-4 h-4 text-neutral-500 ${loadingStates.database ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {databaseStatus.icon}
                      <span className={`text-sm font-medium ${databaseStatus.color}`}>
                        {databaseStatus.text}
                      </span>
                    </div>
                    {systemStatus.database.code > 0 && (
                      <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                        Code: {systemStatus.database.code}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ollama Service */}
                <div className={`p-4 ${ollamaStatus.bgColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-sm">
                        <Cpu className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                      </div>
                      <div>
                        <h4 className="font-medium text-neutral-900 dark:text-neutral-100">Ollama</h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">LLM Service</p>
                      </div>
                    </div>
                    <button
                      onClick={() => fetchSingleServiceStatus('ollama')}
                      disabled={loadingStates.ollama}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCw className={`w-4 h-4 text-neutral-500 ${loadingStates.ollama ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {ollamaStatus.icon}
                      <span className={`text-sm font-medium ${ollamaStatus.color}`}>
                        {ollamaStatus.text}
                      </span>
                    </div>
                    {systemStatus.ollama.code > 0 && (
                      <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                        Code: {systemStatus.ollama.code}
                      </span>
                    )}
                  </div>
                </div>

                {/* Overall Status Footer */}
                <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-600 dark:text-neutral-400">Overall System</span>
                    {(systemStatus.database.status === 'connected' && systemStatus.ollama.status === 'connected') ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">All Systems Operational</span>
                    ) : (systemStatus.database.status === 'error' || systemStatus.ollama.status === 'error') ? (
                      <span className="text-red-600 dark:text-red-400 font-medium">Some Services Failed</span>
                    ) : (
                      <span className="text-yellow-600 dark:text-yellow-400 font-medium">Checking Services...</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Create Entry Button */}
        <button
          type="button"
          onClick={() => router.push('/create')}
          className="flex items-center gap-2 h-9 px-4 bg-neutral-900 dark:bg-neutral-50 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-neutral-50 dark:text-neutral-900 text-sm font-medium rounded-full shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Entry</span>
        </button>
      </div>

      {/* Main Search Component Layout */}
      <div className="w-full max-w-[584px] flex flex-col items-center gap-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
            Local Knowledge Assistant
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Search your local data and files completely offline
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-4">
          <div className="flex items-center h-[50px] w-full bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 focus-within:border-neutral-400 dark:focus-within:border-neutral-600 rounded-full px-4 gap-3 shadow-sm hover:shadow-md focus-within:shadow-md transition-all duration-200">
            <Search className="w-5 h-5 text-neutral-400 flex-shrink-0" />

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question or search here..."
              className="flex-grow bg-transparent text-sm text-neutral-900 dark:text-neutral-100 outline-none placeholder-neutral-400 dark:placeholder-neutral-500"
            />

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              id="file-upload-input"
              disabled
            />

            <div className="flex items-center flex-shrink-0">
              {selectedFile ? (
                <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 pl-3 pr-1.5 py-1 rounded-full text-xs max-w-[165px] border border-neutral-200 dark:border-neutral-700">
                  <span className="truncate">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-400 dark:text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 opacity-60 cursor-not-allowed"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Add File</span>
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 h-10 px-6 bg-neutral-900 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200 rounded-full font-medium text-sm shadow transition-all duration-150 active:scale-[0.98]"
          >
            <span>Search</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}