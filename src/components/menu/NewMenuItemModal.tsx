import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Replace, Trash2, X } from 'lucide-react'
import type { Category, DietaryType } from '@/types/menu'

export interface NewMenuItemForm {
  imageUrl: string
  name: string
  categoryId: string
  dietaryType: DietaryType
  price: number
  isAvailable: boolean
  description: string
}

interface NewMenuItemModalProps {
  isOpen: boolean
  categories: Category[]
  defaultCategoryId?: string
  onClose: () => void
  onSubmit: (form: NewMenuItemForm) => Promise<void> | void
}

export const NewMenuItemModal = memo(function NewMenuItemModal({ isOpen, categories, defaultCategoryId, onClose, onSubmit }: NewMenuItemModalProps) {
  const selectableCategories = useMemo(
    () => categories.filter((category) => category.id !== 'all' && category.id !== 'best_sellers'),
    [categories],
  )
  const firstCategoryId = selectableCategories[0]?.id ?? ''
  const [form, setForm] = useState({ imageUrl: '', name: '', categoryId: defaultCategoryId ?? '', dietaryType: 'non-veg' as DietaryType, price: '', isAvailable: true, description: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setForm({ imageUrl: '', name: '', categoryId: defaultCategoryId ?? firstCategoryId, dietaryType: 'non-veg', price: '', isAvailable: true, description: '' })
      setError(null)
      setUploadError(null)
    }
  }, [isOpen, defaultCategoryId, firstCategoryId])

  if (!isOpen) return null

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function readImage(file: File) {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setUploadError('Choose a JPG or PNG image.')
      return
    }
    setUploadError(null)
    const reader = new FileReader()
    reader.onload = () => update('imageUrl', typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
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
    const price = Number(form.price)
    if (!form.name.trim() || !form.categoryId || !Number.isFinite(price) || price < 0) {
      setError('Enter a name, category, and valid price.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await onSubmit({ ...form, name: form.name.trim(), price, imageUrl: form.imageUrl.trim(), description: form.description.trim() })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create dish.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="menu-modal-overlay" role="dialog" aria-modal="true" aria-label="New Menu Item">
      <form className="menu-modal-panel menu-modal-panel-wide" onSubmit={handleSubmit}>
        <header className="menu-modal-header">
          <button type="button" className="menu-modal-close" onClick={onClose} disabled={isSaving} aria-label="Close"><X className="h-5 w-5" /></button>
        </header>
        <div className="menu-modal-body">
          <div className="menu-item-row menu-item-primary-row">
            <div className="menu-modal-field">
              <span>Dish image</span>
              <div
                className={`menu-image-upload ${isDragging ? 'is-dragging' : ''} ${form.imageUrl ? 'has-image' : ''}`}
                role="button"
                tabIndex={isSaving ? -1 : 0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click() }}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                aria-label="Upload dish image"
              >
                {form.imageUrl ? <img src={form.imageUrl} alt="Dish preview" /> : <><ImagePlus className="menu-image-upload-icon" /><strong>Drop an image here</strong><small>or click to browse JPG or PNG</small></>}
                {form.imageUrl && <div className="menu-image-upload-actions" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSaving}><Replace className="h-4 w-4" />Replace</button><button type="button" onClick={() => update('imageUrl', '')} disabled={isSaving}><Trash2 className="h-4 w-4" />Remove</button></div>}
              </div>
              <input ref={fileInputRef} className="menu-image-file-input" type="file" accept="image/jpeg,image/png" onChange={handleFileChange} disabled={isSaving} />
              {uploadError && <small className="menu-modal-error" role="alert">{uploadError}</small>}
            </div>
            <div className="menu-item-fields">
              <label className="menu-modal-field"><span>Name</span><input value={form.name} onChange={(event) => update('name', event.target.value)} autoFocus placeholder="e.g. Garlic Butter Chicken" disabled={isSaving} /></label>
              <label className="menu-modal-field"><span>Category</span><select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)} disabled={isSaving}><option value="" disabled>Select category</option>{selectableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <fieldset className="menu-modal-field"><legend>Dietary</legend><div className={`menu-modal-choice-row ${form.dietaryType === 'non-veg' ? 'is-second-selected' : ''}`}><span className="menu-modal-choice-slider" aria-hidden="true" /><button type="button" onClick={() => update('dietaryType', 'veg')} disabled={isSaving}>Vegetarian</button><button type="button" onClick={() => update('dietaryType', 'non-veg')} disabled={isSaving}>Non-vegetarian</button></div></fieldset>
            </div>
          </div>
          <div className="menu-item-row menu-item-secondary-row">
            <label className="menu-modal-field"><span>Price (₱)</span><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => update('price', event.target.value)} placeholder="0.00" disabled={isSaving} /></label>
            <fieldset className="menu-modal-field"><legend>Availability</legend><div className={`menu-modal-choice-row ${!form.isAvailable ? 'is-second-selected' : ''}`}><span className="menu-modal-choice-slider" aria-hidden="true" /><button type="button" onClick={() => update('isAvailable', true)} disabled={isSaving}>Available</button><button type="button" onClick={() => update('isAvailable', false)} disabled={isSaving}>Out of stock</button></div></fieldset>
          </div>
          {error && <p className="menu-modal-error" role="alert">{error}</p>}
        </div>
        <footer className="menu-modal-footer"><button type="button" className="menu-modal-cancel" onClick={onClose} disabled={isSaving}>Cancel</button><button type="submit" className="menu-modal-submit" disabled={isSaving}>{isSaving ? 'Adding...' : 'Add dish'}</button></footer>
      </form>
    </div>
  )
})
