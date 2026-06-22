"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Hash, AlignLeft, Type, BookOpen, Tags, FolderOpen, PlusCircle, Bold, Italic, Code, Heading1, Heading2, Quote, Eye, Edit3, Loader2 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

export default function CreateEntryPage() {
  const router = useRouter();
  
  // Categories list - fetched from API
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    type: '',
    categoryId: '',
    tags: [] as string[],
  });
  
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true);
        setCategoriesError(null);
        
        const response = await fetch('/api/categories');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle different response formats
        let categoriesArray: Category[] = [];
        
        if (Array.isArray(data)) {
          categoriesArray = data;
        } else if (data.categories && Array.isArray(data.categories)) {
          categoriesArray = data.categories;
        } else if (data.data && Array.isArray(data.data)) {
          categoriesArray = data.data;
        }
        
        // Validate and set categories
        if (categoriesArray.length > 0) {
          const validCategories = categoriesArray.filter(cat => cat && cat.id && cat.name);
          setCategories(validCategories);
        } else {
          setCategories([]);
        }
        
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        setCategoriesError(error instanceof Error ? error.message : 'Failed to load categories');
        setCategories([]);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // Create new category API call
  const createNewCategory = async (categoryName: string): Promise<Category | null> => {
    try {
      setIsCreatingCategory(true);
      
      const response = await fetch('/api/create-category', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: categoryName }),
      });
      
      if (response.status === 201) {
        const data = await response.json();
        // Return the created category with its ID
        return { id: data.id, name: categoryName };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to create category:', errorData);
        alert(`Failed to create category: ${errorData.message || 'Unknown error'}`);
        return null;
      }
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Network error while creating category. Please try again.');
      return null;
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleAddNewCategory = async () => {
    const trimmedCategory = newCategory.trim();
    
    if (!trimmedCategory) {
      alert('Please enter a category name');
      return;
    }
    
    if (categories.some(cat => cat.name === trimmedCategory)) {
      alert('Category already exists');
      return;
    }
    
    // First, save to API
    const createdCategory = await createNewCategory(trimmedCategory);
    
    // If API returns 201, then add to local state
    if (createdCategory) {
      setCategories(prev => [...prev, createdCategory]);
      setFormData(prev => ({ ...prev, categoryId: createdCategory.id }));
      setNewCategory('');
      setShowNewCategoryInput(false);
    }
  };

  // Create new entry API call with better error handling
  const createNewEntry = async (entryData: Record<string, unknown>) => {
    
    try {
      const response = await fetch('/api/entries/create-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entryData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error in createNewEntry:', error);
      throw error;
    }
  };

  // Simple Markdown parser
  const renderMarkdown = (text: string) => {
    let html = text;
    
    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-neutral-900 dark:text-neutral-100">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-5 mb-3 text-neutral-900 dark:text-neutral-100">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-4 text-neutral-900 dark:text-neutral-100">$1</h1>');
    
    // Bold and Italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg overflow-x-auto my-3"><code class="text-sm font-mono text-neutral-800 dark:text-neutral-200">$1</code></pre>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-sm font-mono text-rose-600 dark:text-rose-400">$1</code>');
    
    // Lists
    html = html.replace(/^- (.*$)/gm, '<li class="ml-4 mb-1">$1</li>');
    html = html.replace(/^\d+\. (.*$)/gm, '<li class="ml-4 mb-1 list-decimal">$1</li>');
    
    // Quotes
    html = html.replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-neutral-300 dark:border-neutral-700 pl-4 my-3 text-neutral-600 dark:text-neutral-400 italic">$1</blockquote>');
    
    // Line breaks and paragraphs
    html = html.replace(/\n\n/g, '</p><p class="mb-3">');
    html = '<p class="mb-3">' + html + '</p>';
    
    return html;
  };

  const insertMarkdown = (syntax: string) => {
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.content.substring(start, end);
    let newText = '';
    
    switch(syntax) {
      case 'bold':
        newText = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        newText = `*${selectedText || 'italic text'}*`;
        break;
      case 'code':
        newText = `\`${selectedText || 'code'}\``;
        break;
      case 'h1':
        newText = `# ${selectedText || 'Heading 1'}`;
        break;
      case 'h2':
        newText = `## ${selectedText || 'Heading 2'}`;
        break;
      case 'quote':
        newText = `> ${selectedText || 'quote text'}`;
        break;
      default:
        return;
    }
    
    const newContent = formData.content.substring(0, start) + newText + formData.content.substring(end);
    setFormData({ ...formData, content: newContent });
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showNewCategoryInput) {
        handleAddNewCategory();
      } else {
        handleAddTag();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }
    
    if (!formData.content.trim()) {
      alert('Please enter content');
      return;
    }
    
    if (!formData.type.trim()) {
      alert('Please select a type');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare data for API - match exactly what the backend expects
      const entryPayload = {
        title: formData.title.trim(),
        content: formData.content,
        summary: formData.summary?.trim() || null,
        type: formData.type,
        category: formData.categoryId || null, // Send null if no category selected
        tags: formData.tags.length > 0 ? formData.tags : [], // Send empty array if no tags
      };
      
      
      const result = await createNewEntry(entryPayload);
      
      if (result.success) {
        alert('Entry created successfully!');
        router.push('/');
      } else {
        throw new Error(result.error || 'Failed to create entry');
      }
      
    } catch (error) {
      console.error('Error creating entry:', error);
      alert(error instanceof Error ? error.message : 'Failed to create entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-[#fafafa] dark:bg-[#121212] p-4 overflow-x-hidden">
      
      {/* Back Button */}
      <div className="absolute top-6 left-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 h-9 px-4 bg-white dark:bg-[#1e1e1e] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-medium rounded-full border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Main Form Container */}
      <div className="w-full max-w-4xl mt-16 mb-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-neutral-900 dark:bg-neutral-50 rounded-full mb-4">
            <Plus className="w-6 h-6 text-neutral-50 dark:text-neutral-900" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
            Create New Entry
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Add a new knowledge entry to your local database with Markdown support
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title Field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <Type className="w-4 h-4" />
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter entry title..."
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
              required
            />
          </div>

          {/* Content Field with Markdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <AlignLeft className="w-4 h-4" />
                Content <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  {previewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {previewMode ? 'Edit' : 'Preview'}
                </button>
              </div>
            </div>
            
            {/* Markdown Toolbar */}
            {!previewMode && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-t-xl border-b-0">
                <button
                  type="button"
                  onClick={() => insertMarkdown('h1')}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Heading 1"
                >
                  <Heading1 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('h2')}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Heading 2"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1" />
                <button
                  type="button"
                  onClick={() => insertMarkdown('bold')}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('italic')}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1" />
                <button
                  type="button"
                  onClick={() => insertMarkdown('code')}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Inline Code"
                >
                  <Code className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('quote')}
                  className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Quote"
                >
                  <Quote className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Editor / Preview Area */}
            {!previewMode ? (
              <textarea
                id="content-editor"
                name="content"
                value={formData.content}
                onChange={handleChange}
                placeholder="Write your content here using Markdown...&#10;&#10;# Heading 1&#10;## Heading 2&#10;**Bold text**&#10;*Italic text*&#10;`code`&#10;&#10;- List item 1&#10;- List item 2&#10;&#10;> Quote text"
                rows={12}
                className="w-full px-4 py-3 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-b-xl rounded-t-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors resize-y font-mono text-sm"
              />
            ) : (
              <div className="min-h-[300px] p-4 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                {formData.content ? (
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(formData.content) }} />
                ) : (
                  <p className="text-neutral-400 dark:text-neutral-500 italic">Nothing to preview yet...</p>
                )}
              </div>
            )}
            
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Supports Markdown: # Headers, **bold**, *italic*, `code`, lists, and quotes
            </p>
          </div>

          {/* Summary Field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <BookOpen className="w-4 h-4" />
              Summary
            </label>
            <textarea
              name="summary"
              value={formData.summary}
              onChange={handleChange}
              placeholder="Brief summary of the content (optional)..."
              rows={3}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors resize-y"
            />
          </div>

          {/* Type Field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <Hash className="w-4 h-4" />
              Type <span className="text-red-500">*</span>
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors cursor-pointer"
              required
            >
              <option value="">Select type...</option>
              <option value="article">Article</option>
              <option value="documentation">Documentation</option>
              <option value="note">Note</option>
              <option value="tutorial">Tutorial</option>
              <option value="reference">Reference</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Category Field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <FolderOpen className="w-4 h-4" />
              Category
            </label>
            
            {isLoadingCategories ? (
              <div className="flex items-center justify-center p-4 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl">
                <div className="animate-pulse flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
                  <span className="text-sm">Loading categories...</span>
                </div>
              </div>
            ) : categoriesError ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <X className="w-4 h-4" />
                  <span className="text-sm">Failed to load categories: {categoriesError}</span>
                </div>
                <p className="text-xs text-red-500 dark:text-red-300 mt-1">
                  You can still create and add new categories manually.
                </p>
              </div>
            ) : (
              <>
                {!showNewCategoryInput ? (
                  <div className="flex gap-2">
                    <select
                      name="categoryId"
                      value={formData.categoryId}
                      onChange={handleChange}
                      className="flex-grow px-4 py-2.5 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors cursor-pointer"
                    >
                      <option value="">Select category...</option>
                      {categories.length === 0 ? (
                        <option value="" disabled>No categories available</option>
                      ) : (
                        categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCategoryInput(true)}
                      className="px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium text-sm transition-all active:scale-[0.98] flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">New</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter new category name..."
                      className="flex-grow px-4 py-2.5 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
                      autoFocus
                      disabled={isCreatingCategory}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCategory}
                      disabled={isCreatingCategory}
                      className="px-4 py-2.5 bg-neutral-900 dark:bg-neutral-50 text-neutral-50 dark:text-neutral-900 rounded-xl font-medium text-sm transition-all active:scale-[0.98] hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isCreatingCategory ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategory('');
                      }}
                      disabled={isCreatingCategory}
                      className="px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Tags Field */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <Tags className="w-4 h-4" />
              Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add tags (press Enter)..."
                className="flex-grow px-4 py-2.5 bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium text-sm transition-all active:scale-[0.98]"
              >
                Add
              </button>
            </div>
            
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-full text-xs"
                  >
                    <Tags className="w-3 h-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 h-11 px-4 bg-white dark:bg-[#1e1e1e] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium rounded-xl border border-neutral-200 dark:border-neutral-800 transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-11 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-50 dark:hover:bg-neutral-200 text-neutral-50 dark:text-neutral-900 font-medium rounded-xl shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'New Entry'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}