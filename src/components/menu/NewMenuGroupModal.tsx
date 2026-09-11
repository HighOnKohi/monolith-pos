import { memo, useEffect, useRef, useState } from 'react'
import { ImagePlus, Replace, Trash2, X } from 'lucide-react'
import type { Category, MenuItem } from '@/types/menu'
import { uploadMenuItemImage } from '@/services/storageService'

export interface NewMenuGroupForm {
  name: string
  description: string
  price: number
  imageUrl?: string
  status: string
  orderLimit: number
  categoryId: string
  itemIds: string[]
}

export interface MenuGroupValue extends NewMenuGroupForm {
  id: string
}

interface NewMenuGroupModalProps {
  isOpen: boolean
  items: MenuItem[]
  categories: Category[]
  editGroup?: MenuGroupValue | null
  onClose: () => void
  onSubmit: (form: NewMenuGroupForm) => Promise<void> | void
}

export const NewMenuGroupModal = memo(function NewMenuGroupModal({ isOpen, items, categories, editGroup, onClose, onSubmit }: NewMenuGroupModalProps) {
  const [form, setForm] = useState({ name: '', description: '', price: '', imageUrl: '', status: 'AVAILABLE', orderLimit: '0', categoryId: '', itemIds: [] as string[] })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setForm(editGroup ? { name: editGroup.name, description: editGroup.description, price: String(editGroup.price), imageUrl: editGroup.imageUrl ?? '', status: editGroup.status, orderLimit: String(editGroup.orderLimit), categoryId: editGroup.categoryId, itemIds: editGroup.itemIds } : { name: '', description: '', price: '', imageUrl: '', status: 'AVAILABLE', orderLimit: '0', categoryId: categories.find((category) => category.id !== 'all')?.id ?? '', itemIds: [] })
    setImageFile(null)
    setError(null)
    setUploadError(null)
  }, [isOpen, editGroup, categories])

  if (!isOpen) return null

  function update(field: keyof typeof form, value: string | string[]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function readImage(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Choose a JPG, PNG, or WEBP image.')
      return
    }
    setUploadError(null)
    setImageFile(file)
    update('imageUrl', URL.createObjectURL(file))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const price = Number(form.price.replace(/,/g, ''))
    const orderLimit = Number(form.orderLimit.replace(/,/g, ''))
    if (!form.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(orderLimit) || orderLimit < 0 || form.itemIds.length === 0) {
      setError('Enter a group name, valid values, and select at least one item.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      let imageUrl = form.imageUrl
      if (imageFile) imageUrl = await uploadMenuItemImage(imageFile, form.name || 'group')
      await onSubmit({ name: form.name.trim(), description: form.description.trim(), price, imageUrl: imageUrl.trim() || undefined, status: form.status, orderLimit, categoryId: form.categoryId, itemIds: form.itemIds })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="menu-modal-overlay" role="dialog" aria-modal="true">
      <form className="menu-modal-panel menu-modal-panel-wide" onSubmit={handleSubmit}>
        <header className="menu-modal-header">
          <h2>Adding New Group Item...</h2>
          <button type="button" className="menu-modal-close" onClick={onClose} disabled={isSaving} aria-label="Close"><X /></button>
        </header>
        <div className="menu-modal-body">
          <div className="menu-item-row">
            <label className="menu-modal-field">
              <span>Group image</span>
              <div className={`menu-image-upload ${form.imageUrl ? 'has-image' : ''}`} role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()}>
                {form.imageUrl ? <img src={form.imageUrl} alt="Group preview" /> : <><ImagePlus className="menu-image-upload-icon" /><strong>Drop an image here</strong><small>or click to browse JPG or PNG</small></>}
                {form.imageUrl && <div className="menu-image-upload-actions" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSaving}><Replace />Replace</button><button type="button" onClick={() => { update('imageUrl', ''); setImageFile(null) }} disabled={isSaving}><Trash2 />Remove</button></div>}
              </div>
              <input ref={fileInputRef} className="menu-image-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImage(file); event.target.value = '' }} disabled={isSaving} />
              {uploadError && <small className="menu-modal-error">{uploadError}</small>}
            </label>
            <div className="menu-item-fields">
              <label className="menu-modal-field"><span>Group name</span><input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Family Meal" disabled={isSaving} autoFocus /></label>
              <label className="menu-modal-field"><span>Description</span><textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Short description (optional)" disabled={isSaving} /></label>
              <label className="menu-modal-field"><span>Group price</span><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => update('price', event.target.value)} placeholder="0.00" disabled={isSaving} /></label>
            </div>
          </div>
          <div className="menu-item-row">
            <label className="menu-modal-field"><span>Category</span><select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)} disabled={isSaving}>{categories.filter((category) => category.id !== 'all').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="menu-modal-field"><span>Status</span><select value={form.status} onChange={(event) => update('status', event.target.value)} disabled={isSaving}><option value="AVAILABLE">Available</option><option value="OUT_OF_STOCK">Out of stock</option></select></label>
            <label className="menu-modal-field"><span>Order limit</span><input type="number" min="0" step="1" value={form.orderLimit} onChange={(event) => update('orderLimit', event.target.value)} disabled={isSaving} /></label>
          </div>
          <fieldset className="menu-group-item-picker">
            <legend>Items in this group</legend>
            <div className="menu-group-item-list">
              {items.map((item) => <label key={item.id} className="menu-group-item-option"><input type="checkbox" checked={form.itemIds.includes(item.id)} onChange={(event) => update('itemIds', event.target.checked ? [...form.itemIds, item.id] : form.itemIds.filter((id) => id !== item.id))} disabled={isSaving} /><img src={item.imageUrl} alt="" /><span>{item.name}</span><strong>₱{item.price.toFixed(2)}</strong></label>)}
            </div>
          </fieldset>
          {error && <p className="menu-modal-error" role="alert">{error}</p>}
        </div>
        <footer className="menu-modal-footer"><button type="button" className="menu-modal-cancel" onClick={onClose} disabled={isSaving}>Cancel</button><button type="submit" className="menu-modal-submit" disabled={isSaving}>{isSaving ? 'Adding...' : 'Add group item'}</button></footer>
      </form>
    </div>
  )
})
