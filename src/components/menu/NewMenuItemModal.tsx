import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ImagePlus, Replace, Trash2, X } from 'lucide-react'
import type { Category, DietaryType, MenuItem } from '@/types/menu'
import type { MenuItemGroup } from '@/services/menuService'
import { uploadMenuItemImage } from '@/services/storageService'
import { supabase } from '@/lib/supabase'

export interface NewMenuItemForm {
  imageUrl?: string
  name: string
  categoryId: string
  dietaryType: DietaryType
  price: number
  originalPrice?: number
  discountPercent?: number
  discountAmount?: number
  isBestSeller?: boolean
  isAvailable: boolean
  description?: string
  orderLimit: number
  itemIds: string[]
}

interface NewMenuItemModalProps {
  isOpen: boolean
  categories: Category[]
  defaultCategoryId?: string
  editItem?: MenuItem | null
  editGroup?: MenuItemGroup | null
  items?: MenuItem[]
  presetId?: number
  onClose: () => void
  onSubmit: (form: NewMenuItemForm) => Promise<void> | void
}

export const NewMenuItemModal = memo(function NewMenuItemModal({
  isOpen, categories, defaultCategoryId, editItem, editGroup, items = [], presetId, onClose, onSubmit,
}: NewMenuItemModalProps) {
  const isEditMode = Boolean(editItem || editGroup)

  const effectivePresetId = presetId ?? editItem?.presetId ?? editGroup?.presetId

  const selectableItems = useMemo(() => {
    return items.filter((item) => {
      if (item.id === editItem?.id || item.id === editGroup?.id) return false
      if (effectivePresetId !== undefined && item.presetId !== undefined) {
        return item.presetId === effectivePresetId
      }
      return true
    })
  }, [items, editItem?.id, editGroup?.id, effectivePresetId])

  const selectableCategories = useMemo(
    () => categories.filter((c) => {
      if (c.id === 'all') return false
      if (effectivePresetId !== undefined && c.presetId !== undefined) {
        return c.presetId === effectivePresetId
      }
      return true
    }),
    [categories, effectivePresetId],
  )
  const firstCategoryId = selectableCategories[0]?.id ?? ''

  const [form, setForm] = useState({
    imageUrl: '', name: '', categoryId: defaultCategoryId ?? '',
    dietaryType: 'veg' as DietaryType, priceRaw: '', isAvailable: true, description: '',
    hasDiscount: false, originalPriceRaw: '', discountPercentRaw: '', isBestSeller: false,
    orderLimitRaw: '0', itemIds: [] as string[],
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

    if (editItem || editGroup) {
      const hasItemDiscount = Boolean(
        (editItem?.discountPercent && editItem.discountPercent > 0) ||
        (editItem?.originalPrice && editItem.originalPrice > (editItem?.price ?? 0))
      )
      setForm({
        imageUrl: editItem?.imageUrl ?? editGroup?.imageUrl ?? '',
        name: editItem?.name ?? editGroup?.name ?? '',
        categoryId: editItem?.categoryId ?? editGroup?.categoryId ?? firstCategoryId,
        dietaryType: editItem?.dietaryType ?? 'veg',
        priceRaw: String(editItem?.price ?? editGroup?.price ?? ''),
        isAvailable: editItem?.isAvailable ?? editGroup?.status === 'AVAILABLE',
        description: editItem?.description ?? editGroup?.description ?? '',
        hasDiscount: hasItemDiscount,
        originalPriceRaw: editItem?.originalPrice ? String(editItem.originalPrice) : '',
        discountPercentRaw: editItem?.discountPercent ? String(editItem.discountPercent) : '',
        isBestSeller: Boolean(editItem?.isBestSeller),
        orderLimitRaw: String(editGroup?.orderLimit ?? 0),
        itemIds: editGroup?.itemIds ?? [],
      })
      setImageFile(null)
    } else {
      setForm({
        imageUrl: '', name: '',
        categoryId:  defaultCategoryId ?? firstCategoryId,
        dietaryType: 'veg', priceRaw: '', isAvailable: true, description: '',
        hasDiscount: false, originalPriceRaw: '', discountPercentRaw: '', isBestSeller: false,
        orderLimitRaw: '0', itemIds: [],
      })
      setImageFile(null)
    }
  }, [isOpen, editItem, editGroup, defaultCategoryId, firstCategoryId])

  useEffect(() => {
    if (!isOpen || !editItem || editGroup) return
    let active = true

    void supabase
      .schema('menu')
      .from('Item_Groups')
      .select('ITEM_ID')
      .eq('MENU_GROUP_ID', Number(editItem.id))
      .then(({ data, error: fetchErr }) => {
        if (!fetchErr && data && active && data.length > 0) {
          const loadedIds = data.map((r: Record<string, unknown>) => String(r['ITEM_ID']))
          setForm((current) => ({
            ...current,
            itemIds: Array.from(new Set([...current.itemIds, ...loadedIds])),
          }))
        }
      })

    return () => {
      active = false
    }
  }, [isOpen, editItem, editGroup])

  if (!isOpen) return null

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((cur) => ({ ...cur, [field]: value }))
    if (field === 'name')  setFieldErrors((e) => ({ ...e, name: undefined }))
    if (field === 'priceRaw') setFieldErrors((e) => ({ ...e, price: undefined }))
  }

  function handleDiscountPercentChange(percentStr: string) {
    const clean = percentStr.replace(/[^\d.]/g, '')
    const pct = parseFloat(clean)
    const origPrice = parseFloat(form.originalPriceRaw.replace(/,/g, ''))

    if (!isNaN(pct) && pct >= 0 && pct <= 100 && !isNaN(origPrice) && origPrice > 0) {
      const discounted = origPrice * (1 - pct / 100)
      setForm((cur) => ({
        ...cur,
        discountPercentRaw: clean,
        priceRaw: discounted.toFixed(2),
      }))
    } else {
      setForm((cur) => ({ ...cur, discountPercentRaw: clean }))
    }
  }

  function handleOriginalPriceChange(origStr: string) {
    const clean = origStr.replace(/[^\d.]/g, '')
    const origPrice = parseFloat(clean)
    const pct = parseFloat(form.discountPercentRaw)

    if (!isNaN(pct) && pct >= 0 && pct <= 100 && !isNaN(origPrice) && origPrice > 0) {
      const discounted = origPrice * (1 - pct / 100)
      setForm((cur) => ({
        ...cur,
        originalPriceRaw: clean,
        priceRaw: discounted.toFixed(2),
      }))
    } else {
      setForm((cur) => ({ ...cur, originalPriceRaw: clean }))
    }
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
    const orderLimit = Number(form.orderLimitRaw.replace(/,/g, ''))

    const errors: { name?: string; price?: string } = {}
    if (!form.name.trim())                         errors.name  = 'Name is required.'
    if (!Number.isFinite(price) || price < 0 || form.priceRaw.trim() === '')
                                                   errors.price = 'Price is required.'

    let originalPrice: number | undefined = undefined
    let discountPercent: number | undefined = undefined
    if (form.hasDiscount) {
      const orig = Number(form.originalPriceRaw.replace(/,/g, ''))
      const pct = Number(form.discountPercentRaw)
      if (Number.isFinite(orig) && orig > price) {
        originalPrice = orig
        discountPercent = Number.isFinite(pct) && pct > 0 ? pct : Math.round(((orig - price) / orig) * 100)
      } else if (Number.isFinite(pct) && pct > 0 && pct < 100) {
        discountPercent = pct
        originalPrice = Number((price / (1 - pct / 100)).toFixed(2))
      }
    }

    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }

    setIsSaving(true)
    setError(null)
    try {
      let finalImageUrl = form.imageUrl

      if (imageFile) {
        setIsUploading(true)
        finalImageUrl = await uploadMenuItemImage(imageFile, form.name || 'dish')
      }

      const selectableIds = new Set(selectableItems.map((item) => item.id))
      const sanitizedItemIds = form.itemIds.filter((id) => selectableIds.has(id))

      await onSubmit({
        imageUrl:    finalImageUrl?.trim() || undefined,
        name:        form.name.trim(),
        categoryId:  form.categoryId,
        dietaryType: form.dietaryType,
        price,
        originalPrice,
        discountPercent,
        isBestSeller: form.isBestSeller,
        isAvailable: form.isAvailable,
        description: form.description,
        orderLimit: Number.isFinite(orderLimit) && orderLimit >= 0 ? orderLimit : 0,
        itemIds: sanitizedItemIds,
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
          <div className="menu-item-row menu-item-secondary-row" aria-label="Price and availability">
            <label className="menu-modal-field">
              <span>{form.hasDiscount ? 'Discounted Selling Price' : 'Price'} {fieldErrors.price && <span className="menu-modal-inline-error">{fieldErrors.price}</span>}</span>
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

          {/* Row 3 — Discount & Best Seller Promo Controls */}
          <div className="rounded-xl border border-[#9BA4B4]/20 bg-[#F8FAFC] p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#14274E]">Promotions & Tags</span>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#14274E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isBestSeller}
                  onChange={(e) => update('isBestSeller', e.target.checked)}
                  disabled={isSaving}
                  className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                />
                <span className="inline-flex items-center gap-1">
                  <span className="text-amber-500 font-bold">★</span> Mark as Best Seller
                </span>
              </label>
            </div>

            {/* Discount Toggle & Fields */}
            <div className="flex flex-col gap-2 pt-1 border-t border-[#9BA4B4]/15">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#14274E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasDiscount}
                  onChange={(e) => update('hasDiscount', e.target.checked)}
                  disabled={isSaving}
                  className="h-4 w-4 rounded text-[#14274E] focus:ring-[#14274E]"
                />
                <span>Apply Item Discount & Promo Tag</span>
              </label>

              {form.hasDiscount && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="menu-modal-field">
                    <span className="text-[11px] font-semibold text-[#394867]">Original Price (₱)</span>
                    <div className="menu-modal-price-wrap">
                      <span className="menu-modal-price-symbol">₱</span>
                      <input
                        className="menu-modal-price-input"
                        type="text"
                        value={form.originalPriceRaw}
                        onChange={(e) => handleOriginalPriceChange(e.target.value)}
                        placeholder="e.g. 250.00"
                        disabled={isSaving}
                      />
                    </div>
                  </label>

                  <label className="menu-modal-field">
                    <span className="text-[11px] font-semibold text-[#394867]">Discount (%)</span>
                    <div className="menu-modal-price-wrap">
                      <span className="menu-modal-price-symbol">%</span>
                      <input
                        className="menu-modal-price-input"
                        type="number"
                        min="1"
                        max="99"
                        value={form.discountPercentRaw}
                        onChange={(e) => handleDiscountPercentChange(e.target.value)}
                        placeholder="e.g. 20"
                        disabled={isSaving}
                      />
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          <label className="menu-modal-field">
            <span>Order limit</span>
            <input type="number" min="0" step="1" value={form.orderLimitRaw} onChange={(event) => update('orderLimitRaw', event.target.value)} disabled={isSaving} />
          </label>

          {selectableItems.length > 0 && (
            <fieldset className="menu-group-item-picker">
              <legend>Group items (optional)</legend>
              <div className="menu-group-item-list">
                {selectableItems.map((item) => (
                  <label key={item.id} className="menu-group-item-option">
                    <input type="checkbox" checked={form.itemIds.includes(item.id)} onChange={(event) => update('itemIds', event.target.checked ? [...form.itemIds, item.id] : form.itemIds.filter((id) => id !== item.id))} disabled={isSaving} />
                    <img src={item.imageUrl} alt="" />
                    <span>{item.name}</span>
                    <strong>₱{item.price.toFixed(2)}</strong>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {error && <p className="menu-modal-error" role="alert">{error}</p>}
        </div>

        <footer className="menu-modal-footer">
          <button type="button" className="menu-modal-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="menu-modal-submit" disabled={isSaving}>
            {isUploading
              ? 'Uploading image...'
              : isSaving
                ? (isEditMode ? 'Saving...' : 'Adding...')
                : (isEditMode ? 'Save changes' : (form.itemIds.length > 0 ? 'Add group item' : 'Add dish'))}
          </button>
        </footer>
      </form>
    </div>
  )
})
