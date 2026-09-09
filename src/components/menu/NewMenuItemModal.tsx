import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ImagePlus, Replace, Trash2, X } from 'lucide-react'
import type { Category, DietaryType, MenuItem } from '@/types/menu'
import { uploadMenuItemImage } from '@/services/storageService'

export interface NewMenuItemForm {
  imageUrl?: string
  name: string
  categoryId: string
  dietaryType: DietaryType
  price: number
  isAvailable: boolean
  description?: string
}

interface NewMenuItemModalProps {
  isOpen: boolean
  categories: Category[]
  defaultCategoryId?: string
  editItem?: MenuItem | null
  onClose: () => void
  onSubmit: (form: NewMenuItemForm) => Promise<void> | void
}

export const NewMenuItemModal = memo(function NewMenuItemModal({
  isOpen, categories, defaultCategoryId, editItem, onClose, onSubmit,
}: NewMenuItemModalProps) {
  const isEditMode = Boolean(editItem)

  const selectableCategories = useMemo(
    () => categories.filter((c) => c.id !== 'all'),
    [categories],
  )
  const firstCategoryId = selectableCategories[0]?.id ?? ''

  const [form, setForm] = useState({
    imageUrl: '', name: '', categoryId: defaultCategoryId ?? '',
    dietaryType: 'veg' as DietaryType, priceRaw: '', isAvailable: true, description: '',
  })
  const [imageFile, setImageFile]     = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; price?: string }>({})
  const [isSaving, setIsSaving]       = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [catOpen, setCatOpen]         = useState(false)
  const [catVisible, setCatVisible]   = useState(false)
  const catCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)

  function openCat() {
    if (catCloseTimer.current) clearTimeout(catCloseTimer.current)
    setCatOpen(true)
    setCatVisible(true)
  }

  function closeCat() {
    setCatOpen(false)
    catCloseTimer.current = setTimeout(() => setCatVisible(false), 180)
  }

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setFieldErrors({})
    setUploadError(null)

    if (editItem) {
      setForm({
        imageUrl:    editItem.imageUrl ?? '',
        name:        editItem.name,
        categoryId:  editItem.categoryId,
        dietaryType: editItem.dietaryType,
        priceRaw:    editItem.price > 0 ? editItem.price.toString() : '',
        isAvailable: editItem.isAvailable,
        description: editItem.description ?? '',
      })
      setImageFile(null)
    } else {
      setForm({
        imageUrl: '', name: '',
        categoryId:  defaultCategoryId ?? firstCategoryId,
        dietaryType: 'veg', priceRaw: '', isAvailable: true, description: '',
      })
      setImageFile(null)
    }
  }, [isOpen, editItem, defaultCategoryId, firstCategoryId])

  if (!isOpen) return null

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((cur) => ({ ...cur, [field]: value }))
    if (field === 'name')  setFieldErrors((e) => ({ ...e, name: undefined }))
    if (field === 'priceRaw') setFieldErrors((e) => ({ ...e, price: undefined }))
  }

  function readImage(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Choose a JPG, PNG, or WEBP image.')
      return
    }
    setUploadError(null)
    setImageFile(file)
    const localPreview = URL.createObjectURL(file)
    update('imageUrl', localPreview)
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) readImage(file)
    event.target.value = ''
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) readImage(file)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const price = Number(form.priceRaw.replace(/,/g, '').replace(/\.$/, ''))

    const errors: { name?: string; price?: string } = {}
    if (!form.name.trim())                         errors.name  = 'Name is required.'
    if (!Number.isFinite(price) || price < 0 || form.priceRaw.trim() === '')
                                                   errors.price = 'Price is required.'
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }

    setIsSaving(true)
    setError(null)
    try {
      let finalImageUrl = form.imageUrl

      if (imageFile) {
        setIsUploading(true)
        finalImageUrl = await uploadMenuItemImage(imageFile, form.name || 'dish')
      }

      await onSubmit({
        imageUrl:    finalImageUrl?.trim() || undefined,
        name:        form.name.trim(),
        categoryId:  form.categoryId,
        dietaryType: form.dietaryType,
        price,
        isAvailable: form.isAvailable,
        description: form.description,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsSaving(false)
      setIsUploading(false)
    }
  }

  return (
    <div className="menu-modal-overlay" role="dialog" aria-modal="true">
      <form className="menu-modal-panel menu-modal-panel-wide" onSubmit={handleSubmit}>
        <header className="menu-modal-header">
          <h2>{isEditMode ? 'Editing An Item...' : 'Adding New Item...'}</h2>
          <button type="button" className="menu-modal-close" onClick={onClose} disabled={isSaving} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="menu-modal-body">
          {/* Row 1 — image + right fields */}
          <div className="menu-item-row menu-item-primary-row">
            <div className="menu-modal-field">
              <span>Dish image</span>
              <div
                className={`menu-image-upload ${isDragging ? 'is-dragging' : ''} ${form.imageUrl ? 'has-image' : ''}`}
                role="button" tabIndex={isSaving ? -1 : 0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                aria-label="Upload dish image"
              >
                {form.imageUrl
                  ? <img src={form.imageUrl} alt="Dish preview" />
                  : <><ImagePlus className="menu-image-upload-icon" /><strong>Drop an image here</strong><small>or click to browse JPG or PNG</small></>
                }
                {form.imageUrl && (
                  <div className="menu-image-upload-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                      <Replace className="h-4 w-4" />Replace
                    </button>
                    <button type="button" onClick={() => { update('imageUrl', ''); setImageFile(null) }} disabled={isSaving}>
                      <Trash2 className="h-4 w-4" />Remove
                    </button>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} className="menu-image-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} disabled={isSaving} />
              {uploadError && <small className="menu-modal-error" role="alert">{uploadError}</small>}
            </div>

            <div className="menu-item-fields">
              <label className="menu-modal-field">
                <span>Name {fieldErrors.name && <span className="menu-modal-inline-error">{fieldErrors.name}</span>}</span>
                <input
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  autoFocus
                  placeholder="e.g. Garlic Butter Chicken"
                  disabled={isSaving}
                  className={fieldErrors.name ? 'has-error' : ''}
                />
              </label>

              <label className="menu-modal-field">
                <span>Description</span>
                <input value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Short description (optional)" disabled={isSaving} />
              </label>

              <div className="menu-modal-field"><span>Category</span>
                <div className={`menu-modal-dropdown ${catOpen ? 'is-open' : ''}`}>
                  <button type="button" className="menu-modal-dropdown-trigger" onClick={() => catOpen ? closeCat() : openCat()} disabled={isSaving}>
                    <span>{selectableCategories.find((c) => c.id === form.categoryId)?.name ?? 'Select category'}</span>
                    <ChevronDown className="menu-modal-dropdown-arrow" />
                  </button>
                  {catVisible && (
                    <ul className={`menu-modal-dropdown-list ${catOpen ? 'is-open' : 'is-closing'}`} role="listbox">
                      {selectableCategories.map((category) => (
                        <li key={category.id} role="option" aria-selected={form.categoryId === category.id}
                          className={form.categoryId === category.id ? 'is-selected' : ''}
                          onMouseDown={(e) => { e.preventDefault(); update('categoryId', category.id); closeCat() }}>
                          {category.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <fieldset className="menu-modal-field">
                <legend>Dietary</legend>
                <div className={`menu-modal-choice-row ${form.dietaryType === 'non-veg' ? 'is-second-selected' : ''}`}>
                  <span className="menu-modal-choice-slider" aria-hidden="true" />
                  <button type="button" onClick={() => update('dietaryType', 'veg')} disabled={isSaving}>Vegetarian</button>
                  <button type="button" onClick={() => update('dietaryType', 'non-veg')} disabled={isSaving}>Non-vegetarian</button>
                </div>
              </fieldset>
            </div>
          </div>

          {/* Row 2 — price + availability */}
          <div className="menu-item-row menu-item-secondary-row">
            <label className="menu-modal-field">
              <span>Price {fieldErrors.price && <span className="menu-modal-inline-error">{fieldErrors.price}</span>}</span>
              <div className={`menu-modal-price-wrap ${fieldErrors.price ? 'has-error' : ''}`}>
                <span className="menu-modal-price-symbol">₱</span>
                <input
                  className="menu-modal-price-input"
                  type="text"
                  inputMode="decimal"
                  value={form.priceRaw}
                  onChange={(event) => {
                    const raw = event.target.value
                    if (!/^[\d,]*\.?\d{0,2}$/.test(raw)) return
                    const [intPart, decPart] = raw.replace(/,/g, '').split('.')
                    const formatted = intPart === '' ? '' : Number(intPart).toLocaleString()
                    update('priceRaw', decPart !== undefined ? `${formatted}.${decPart}` : formatted)
                  }}
                  placeholder="0.00"
                  disabled={isSaving}
                />
              </div>
            </label>
            <fieldset className="menu-modal-field">
              <legend>Availability</legend>
              <div className={`menu-modal-choice-row ${!form.isAvailable ? 'is-second-selected' : ''}`}>
                <span className="menu-modal-choice-slider" aria-hidden="true" />
                <button type="button" onClick={() => update('isAvailable', true)} disabled={isSaving}>Available</button>
                <button type="button" onClick={() => update('isAvailable', false)} disabled={isSaving}>Out of stock</button>
              </div>
            </fieldset>
          </div>

          {error && <p className="menu-modal-error" role="alert">{error}</p>}
        </div>

        <footer className="menu-modal-footer">
          <button type="button" className="menu-modal-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="menu-modal-submit" disabled={isSaving}>
            {isUploading
              ? 'Uploading image...'
              : isSaving
                ? (isEditMode ? 'Saving...' : 'Adding...')
                : (isEditMode ? 'Save changes' : 'Add dish')}
          </button>
        </footer>
      </form>
    </div>
  )
})
