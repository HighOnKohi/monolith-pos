import { useState, useEffect, useRef } from 'react'
import {
  X,
  Save,
  AlertCircle,
  Image as ImageIcon,
  DollarSign,
  Tag,
  FileText,
  Utensils,
  CheckCircle2,
  Loader2,
  Upload,
} from 'lucide-react'
import { updateMenuItem } from '@/services/menuService'
import { uploadMenuItemImage } from '@/services/storageService'
import type { MenuItem, Category, DietaryType } from '@/types/menu'

interface MenuItemEditSidebarProps {
  item: MenuItem | null
  categories: Category[]
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function MenuItemEditSidebar({
  item,
  categories,
  isOpen,
  onClose,
  onSaved,
}: MenuItemEditSidebarProps) {
  // ── Form State ──
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isAvailable, setIsAvailable] = useState(true)
  const [dietaryType, setDietaryType] = useState<DietaryType>('non-veg')

  // ── UI States ──
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{ name?: string; price?: string; category?: string }>({})

  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Populate form values whenever the selected item changes
  useEffect(() => {
    if (item) {
      setName(item.name || '')
      setPrice(item.price !== undefined ? String(item.price) : '')
      setCategoryId(item.categoryId || '')
      setDescription(item.description || '')
      setImageUrl(item.imageUrl || '')
      setIsAvailable(item.isAvailable)
      setDietaryType(item.dietaryType || 'non-veg')
      setErrorMessage(null)
      setValidationErrors({})
    }
  }, [item])

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen && !item) return null

  // Filter out meta-categories like 'all' or 'best_sellers'
  const selectableCategories = categories.filter(
    (cat) => cat.id !== 'all' && cat.id !== 'best_sellers'
  )

  // ── Form Validation ──
  function validateForm(): boolean {
    const errors: { name?: string; price?: string; category?: string } = {}

    if (!name.trim()) {
      errors.name = 'Item name is required.'
    }

    const numPrice = parseFloat(price)
    if (!price.trim() || isNaN(numPrice) || !isFinite(numPrice) || numPrice < 0) {
      errors.price = 'Price must be a valid non-negative number.'
    }

    if (!categoryId || categoryId === 'all' || categoryId === 'best_sellers') {
      errors.category = 'Please select a valid menu category.'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Save Handler ──
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return

    setErrorMessage(null)

    if (!validateForm()) {
      return
    }

    setIsSaving(true)

    try {
      const numPrice = parseFloat(price)

      await updateMenuItem(item.id, {
        name: name.trim(),
        price: numPrice,
        categoryId,
        description: description.trim(),
        imageUrl: imageUrl.trim() || undefined,
        isAvailable,
        dietaryType,
      })

      // Notify parent to refresh and close sidebar
      onSaved()
      onClose()
    } catch (err: unknown) {
      console.error('[MenuItemEditSidebar] Save failed:', err)
      const message = err instanceof Error ? err.message : 'Failed to update menu item in database.'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingImage(true)
    setErrorMessage(null)
    try {
      const publicUrl = await uploadMenuItemImage(file, name || 'dish')
      setImageUrl(publicUrl)
    } catch (err: unknown) {
      console.error('[MenuItemEditSidebar] Image upload failed:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Image upload failed.')
    } finally {
      setIsUploadingImage(false)
      e.target.value = ''
    }
  }

  return (
    <div
      className={`menu-edit-sidebar-container ${isOpen ? 'is-open' : ''}`}
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-edit-sidebar-title"
    >
      {/* Backdrop overlay */}
      <div
        className="menu-edit-sidebar-backdrop"
        onClick={() => {
          if (!isSaving) onClose()
        }}
      />

      {/* Slide-in panel */}
      <aside
        ref={panelRef}
        className="menu-edit-sidebar-panel"
        tabIndex={-1}
      >
        {/* Header */}
        <header className="menu-edit-sidebar-header">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#14274E] text-[#E9C46A]">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <h2 id="menu-edit-sidebar-title" className="text-base font-bold text-[#14274E]">
                Edit Menu Item
              </h2>
              <p className="text-xs text-[#9BA4B4]">
                ID: #{item?.id || '—'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#9BA4B4]/20 text-[#394867] hover:bg-[#F1F6F9] hover:text-[#14274E] transition-colors disabled:opacity-40"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="menu-edit-error-banner" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#C94A4A]" />
            <div className="flex-1 text-xs">
              <span className="font-semibold">Update Failed: </span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="menu-edit-sidebar-form">
          {/* Dish Name */}
          <div className="menu-edit-field">
            <label htmlFor="dish-name" className="menu-edit-label">
              <Utensils className="h-3.5 w-3.5 text-[#9BA4B4]" />
              <span>Dish Name <strong className="text-[#C94A4A]">*</strong></span>
            </label>
            <input
              id="dish-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (validationErrors.name) setValidationErrors((prev) => ({ ...prev, name: undefined }))
              }}
              placeholder="e.g. Garlic Butter Chicken"
              className={`menu-edit-input ${validationErrors.name ? 'is-invalid' : ''}`}
              disabled={isSaving}
              autoFocus
            />
            {validationErrors.name && (
              <span className="menu-edit-error-text">{validationErrors.name}</span>
            )}
          </div>

          {/* Category & Price Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div className="menu-edit-field">
              <label htmlFor="dish-category" className="menu-edit-label">
                <Tag className="h-3.5 w-3.5 text-[#9BA4B4]" />
                <span>Category <strong className="text-[#C94A4A]">*</strong></span>
              </label>
              <select
                id="dish-category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value)
                  if (validationErrors.category) setValidationErrors((prev) => ({ ...prev, category: undefined }))
                }}
                className={`menu-edit-select ${validationErrors.category ? 'is-invalid' : ''}`}
                disabled={isSaving}
              >
                <option value="" disabled>Select category</option>
                {selectableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {validationErrors.category && (
                <span className="menu-edit-error-text">{validationErrors.category}</span>
              )}
            </div>

            {/* Price */}
            <div className="menu-edit-field">
              <label htmlFor="dish-price" className="menu-edit-label">
                <DollarSign className="h-3.5 w-3.5 text-[#9BA4B4]" />
                <span>Price (₱) <strong className="text-[#C94A4A]">*</strong></span>
              </label>
              <input
                id="dish-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value)
                  if (validationErrors.price) setValidationErrors((prev) => ({ ...prev, price: undefined }))
                }}
                placeholder="0.00"
                className={`menu-edit-input ${validationErrors.price ? 'is-invalid' : ''}`}
                disabled={isSaving}
              />
              {validationErrors.price && (
                <span className="menu-edit-error-text">{validationErrors.price}</span>
              )}
            </div>
          </div>

          {/* Availability Toggle */}
          <div className="menu-edit-field">
            <span className="menu-edit-label">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#9BA4B4]" />
              <span>Stock Status</span>
            </span>
            <div className="menu-edit-toggle-group">
              <button
                type="button"
                onClick={() => setIsAvailable(true)}
                className={`menu-edit-toggle-btn ${isAvailable ? 'is-active-available' : ''}`}
                disabled={isSaving}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Available (In Stock)
              </button>
              <button
                type="button"
                onClick={() => setIsAvailable(false)}
                className={`menu-edit-toggle-btn ${!isAvailable ? 'is-active-soldout' : ''}`}
                disabled={isSaving}
              >
                <span className="h-2 w-2 rounded-full bg-[#C94A4A]" />
                Sold Out (Unavailable)
              </button>
            </div>
          </div>

          {/* Dietary Type */}
          <div className="menu-edit-field">
            <span className="menu-edit-label">Dietary Classification</span>
            <div className="menu-edit-toggle-group">
              <button
                type="button"
                onClick={() => setDietaryType('non-veg')}
                className={`menu-edit-toggle-btn ${dietaryType === 'non-veg' ? 'is-active-standard' : ''}`}
                disabled={isSaving}
              >
                <span className="h-2 w-2 rounded-full bg-[#C94A4A]" />
                Non-Vegetarian
              </button>
              <button
                type="button"
                onClick={() => setDietaryType('veg')}
                className={`menu-edit-toggle-btn ${dietaryType === 'veg' ? 'is-active-standard' : ''}`}
                disabled={isSaving}
              >
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Vegetarian
              </button>
            </div>
          </div>

          {/* Image URL with Preview */}
          <div className="menu-edit-field">
            <div className="flex items-center justify-between">
              <label htmlFor="dish-image" className="menu-edit-label mb-0">
                <ImageIcon className="h-3.5 w-3.5 text-[#9BA4B4]" />
                <span>Image URL</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving || isUploadingImage}
                className="flex items-center gap-1 text-xs font-semibold text-[#3F72AF] hover:underline disabled:opacity-50"
              >
                {isUploadingImage ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3" />
                    <span>Upload File</span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isSaving || isUploadingImage}
              />
            </div>
            <input
              id="dish-image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="menu-edit-input mt-1.5"
              disabled={isSaving || isUploadingImage}
            />

            {/* Thumbnail preview */}
            <div className="menu-edit-image-preview mt-2">
              {imageUrl ? (
                <div className="relative group">
                  <img
                    src={imageUrl}
                    alt={name || 'Preview'}
                    className="h-24 w-full object-cover rounded-lg border border-[#9BA4B4]/20"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    disabled={isSaving}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white hover:bg-red-600 transition-colors text-xs opacity-0 group-hover:opacity-100"
                    title="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-[#9BA4B4]/40 bg-[#F1F6F9] text-xs text-[#9BA4B4]">
                  No image preview available
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="menu-edit-field">
            <label htmlFor="dish-description" className="menu-edit-label">
              <FileText className="h-3.5 w-3.5 text-[#9BA4B4]" />
              <span>Description</span>
            </label>
            <textarea
              id="dish-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description, allergens, prep notes..."
              className="menu-edit-textarea"
              disabled={isSaving}
            />
          </div>

          {/* Action Buttons */}
          <footer className="menu-edit-sidebar-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="menu-edit-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="menu-edit-save-btn"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  )
}
