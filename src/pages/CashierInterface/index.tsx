import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Users,
  ChevronDown,
  ChevronRight,
  Clock,
  GitMerge,
  Trash2,
  FileText,
  Printer,
  CheckCircle2,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAllTables, fetchOrderSummariesForIds, type TableData } from '@/services/tableService'
import { fetchOrdersByTable, settleTableOrders, voidOrderItems } from '@/services/orderService'
import { VoidOrderModal } from '@/pages/ServiceInterface/components/VoidOrderModal'
import { fetchAllBillRequests, resolveBillOutRequest, updateBillRequestStatus } from '@/services/billService'
import { subscribeToOrderUpdates } from '@/services/dispatcherService'
import type { BillRequest } from '@/types/bill'
import type { Order, OrderStatus } from '@/types/order'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import { buildReceiptSnapshot } from '@/components/receipt/buildReceipt'
import { ReceiptPreviewModal } from '@/components/receipt/ReceiptPreviewModal'
import type { ReceiptSnapshot } from '@/components/receipt/types'
import {
  createOrderInvoice,
  createOrderReceipt,
  generateInvoicePdf,
  type OrderInvoiceRecord,
} from '@/services/orderInvoiceService'
import { CashierPaymentModal } from './components/CashierPaymentModal'
import { CashierInvoiceModal } from './components/CashierInvoiceModal'
import { TableAlertsBanner } from '@/components/alerts/TableAlertsBanner'
import { CashierShiftHeaderBar } from '@/components/cashier/CashierShiftHeaderBar'
import { useCashierSession } from '@/hooks/useCashierSession'
import { logCashierAction } from '@/services/cashierAuditService'
import {
  resolveTableAssistance,
  recordAssistanceRequest,
  removeAssistanceRequest,
} from '@/services/assistanceService'
import type { AssistanceRequest } from '@/types/assistance'
import {
  getDiscountPercentages,
  DISCOUNT_CONFIG_CHANGED_EVENT,
  type DiscountConfigurations,
} from '@/services/configurationService'
import { validateAnyActiveStaffCode } from '@/services/staffCodeService'

function playNotificationChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.45)
  } catch {
    // Audio context may be restricted before first user interaction
  }
}

// Active order statuses displayed in cashier
const ALL_ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'REQUESTED',
  'VERIFIED',
  'PREPARING',
  'READY',
  'SERVED',
  'COMPLETED',
]
const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface ItemDiscount {
  pwd: boolean
  senior: boolean
  custom: number
  specific: number
}

export default function CashierInterface() {
  const { shift, staff } = useCashierSession()
  // Tables state
  const [tables, setTables] = useState<TableData[]>([])
  const [summaries, setSummaries] = useState<Map<number, { totalBill: number; activeOrderCount: number }>>(new Map())
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [orders, setOrders] = useState<Order[]>([])

  // Shared discount & receipt state
  const [itemDiscounts, setItemDiscounts] = useState<Map<string, ItemDiscount>>(new Map())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [disableAnimation, setDisableAnimation] = useState(false)
  const [applyAllPwd, setApplyAllPwd] = useState(false)
  const [applyAllSenior, setApplyAllSenior] = useState(false)
  const [applyAllCustom, setApplyAllCustom] = useState<number>(0)
  const [applyAllSpecific, setApplyAllSpecific] = useState<number>(0)
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Void order/item state
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false)
  const [voidTargetOrder, setVoidTargetOrder] = useState<Order | null>(null)
  const [voidInitialItemId, setVoidInitialItemId] = useState<number | null>(null)

  // Sidebar tab state: 'pending' vs 'active'
  const [sidebarTab, setSidebarTab] = useState<'pending' | 'active'>('active')

  // Dynamic Discount Configurations (PWD & Senior Citizen)
  const [discountConfig, setDiscountConfig] = useState<DiscountConfigurations>(getDiscountPercentages())

  useEffect(() => {
    const handleDiscountChange = (e: Event) => {
      const customEvent = e as CustomEvent<DiscountConfigurations>
      if (customEvent.detail) {
        setDiscountConfig(customEvent.detail)
      } else {
        setDiscountConfig(getDiscountPercentages())
      }
    }

    window.addEventListener(DISCOUNT_CONFIG_CHANGED_EVENT, handleDiscountChange)

    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel('monolith_config_events')
      bc.onmessage = (msg) => {
        if (msg.data?.type === 'discount_config_changed') {
          setDiscountConfig(getDiscountPercentages())
        }
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener(DISCOUNT_CONFIG_CHANGED_EVENT, handleDiscountChange)
      if (bc) bc.close()
    }
  }, [])

  // In-line Void Orders mode
  const [isVoidMode, setIsVoidMode] = useState(false)
  const [selectedVoidItemIds, setSelectedVoidItemIds] = useState<Set<string>>(new Set())
  const [isVoiding, setIsVoiding] = useState(false)
  const [isBatchVoidAuthOpen, setIsBatchVoidAuthOpen] = useState(false)
  const [batchVoidAuthCode, setBatchVoidAuthCode] = useState('')
  const [batchVoidAuthError, setBatchVoidAuthError] = useState<string | null>(null)
  const [isAuthorizingBatchVoid, setIsAuthorizingBatchVoid] = useState(false)

  // Invoice & Receipt workflow state
  const [currentInvoice, setCurrentInvoice] = useState<OrderInvoiceRecord | null>(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [isConfirmingInvoice, setIsConfirmingInvoice] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  // Refs for tracking active state without triggering unnecessary recreations
  const selectedIdRef = useRef<number | null>(null)
  const busyRef = useRef<boolean>(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  const showToast = useCallback((_text: string, _type: 'success' | 'info' | 'error' = 'info') => {
    // Popup notifications disabled
  }, [])

  const load = useCallback(async (force = false) => {
    // Avoid background overwrites during active bill-out settlement unless explicitly forced
    if (!force && busyRef.current) return

    try {
      const [nextTables, nextRequests] = await Promise.all([
        fetchAllTables(),
        fetchAllBillRequests(),
      ])
      const nextSummaries = await fetchOrderSummariesForIds(
        nextTables.map((table) => table.TABLE_ID),
        ALL_ACTIVE_ORDER_STATUSES,
      )
      setTables(nextTables)
      setSummaries(nextSummaries)
      setBillRequests(nextRequests)

      const currentSelectedId = selectedIdRef.current
      if (currentSelectedId) {
        const valid = nextTables.some((table) => table.TABLE_ID === currentSelectedId) ? currentSelectedId : null
        if (valid) {
          const group = resolveTableGroupByList(valid, nextTables)
          try {
            const updatedOrders = await fetchOrdersByTable(
              group.anchorTableId,
              ALL_ACTIVE_ORDER_STATUSES,
              group.memberTableIds,
            )
            setOrders(updatedOrders)
          } catch {
            // Keep existing orders if transient fetch error
          }
        } else {
          setSelectedId(null)
          selectedIdRef.current = null
          setOrders([])
        }
      }
    } catch (err) {
      console.error('[CashierInterface] Failed to load data:', err)
      setError('Unable to load cashier data. Please try again.')
    }
  }, [])

  const scheduleLoad = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      void load()
    }, 150)
  }, [load])

  useEffect(() => {
    void load()

    const unsubscribeBus = subscribeToOrderUpdates(() => {
      scheduleLoad()
    })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleLoad()
    }
    const handlePresetChange = () => scheduleLoad()

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    window.addEventListener('table-layout-preset-changed', handlePresetChange)
    window.addEventListener('monolith-order-update', handlePresetChange)

    // Supabase Realtime channel for Cashier
    // Subscribes to orders and tables schemas (with public as secondary fallback)
    const channel = supabase
      .channel('cashier-interface-sync')
      // Schema 'orders' (Primary DB location for orders, order items, discounts, and bill requests)
      .on('postgres_changes', { event: '*', schema: 'orders', table: 'Restaurant_Orders' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'orders', table: 'Order_Items' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'orders', table: 'Bill_Requests' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'orders', table: 'Discounts' }, () => scheduleLoad())
      // Schema 'public' (Secondary fallback for local/test migrations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Orders' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Order_Items' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Bill_Requests' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Discounts' }, () => scheduleLoad())
      // Tables schema for restaurant tables and layout presets
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Active_Tables' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Table_Layout_Presets' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Table_Info' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Active_Tables' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Table_Layout_Presets' }, () => scheduleLoad())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Table_Info' }, () => scheduleLoad())
      // Supabase realtime broadcast events
      .on('broadcast', { event: 'order_update' }, () => scheduleLoad())
      .on('broadcast', { event: 'order_updated' }, () => scheduleLoad())
      .subscribe()

    // Realtime subscription for Assistance broadcasts
    const assistanceChannel = supabase
      .channel('cashier-table-assistance')
      .on('broadcast', { event: 'assistance_request' }, (payload) => {
        if (payload?.payload) {
          const assistReq = payload.payload as AssistanceRequest
          recordAssistanceRequest(assistReq)
          playNotificationChime()
          showToast(`🔔 Table ${assistReq.tableNum ?? assistReq.tableId} is calling: ${assistReq.title}`, 'info')
        }
        scheduleLoad()
      })
      .on('broadcast', { event: 'assistance_resolved' }, (payload) => {
        const tId = payload?.payload?.tableId
        const tIds = payload?.payload?.tableIds
        removeAssistanceRequest(tId, tIds)
        scheduleLoad()
      })
      .subscribe()

    // Background polling fallback (every 10s when tab is active) to guarantee resilience
    const pollingInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && !busyRef.current) {
        void load()
      }
    }, 10000)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      clearInterval(pollingInterval)
      unsubscribeBus()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
      window.removeEventListener('table-layout-preset-changed', handlePresetChange)
      window.removeEventListener('monolith-order-update', handlePresetChange)
      void supabase.removeChannel(channel)
      void supabase.removeChannel(assistanceChannel)
    }
  }, [load, scheduleLoad, showToast])

  // Tables group calculations & hierarchy: Merge Groups first, then Standalone Tables
  const { mergedGroups, standaloneTables } = useMemo(() => {
    const processedTableIds = new Set<number>()
    const merged: Array<{
      groupId: number
      anchorTableNum: number
      groupInfo: ReturnType<typeof resolveTableGroupByList>
      groupSummary: { totalBill: number; activeOrderCount: number }
      tables: Array<{
        table: TableData
        summary: { totalBill: number; activeOrderCount: number }
        enabled: boolean
      }>
    }> = []
    const standalone: Array<{
      table: TableData
      groupInfo: ReturnType<typeof resolveTableGroupByList>
      summary: { totalBill: number; activeOrderCount: number }
      enabled: boolean
    }> = []

    for (const table of tables) {
      if (processedTableIds.has(table.TABLE_ID)) continue

      const groupInfo = resolveTableGroupByList(table.TABLE_ID, tables)
      if (groupInfo.isMerged) {
        const memberTables = tables
          .filter((t) => groupInfo.memberTableIds.includes(t.TABLE_ID))
          .sort((a, b) => (a.TABLE_NUM || a.TABLE_ID) - (b.TABLE_NUM || b.TABLE_ID))

        memberTables.forEach((t) => processedTableIds.add(t.TABLE_ID))

        const groupSummary = groupInfo.memberTableIds.reduce(
          (result, id) => {
            const item = summaries.get(id)
            return {
              totalBill: result.totalBill + (item?.totalBill ?? 0),
              activeOrderCount: result.activeOrderCount + (item?.activeOrderCount ?? 0),
            }
          },
          { totalBill: 0, activeOrderCount: 0 },
        )

        const groupEnabled = groupSummary.activeOrderCount > 0

        const tableItems = memberTables.map((t) => {
          const tableSummary = summaries.get(t.TABLE_ID) ?? { totalBill: 0, activeOrderCount: 0 }
          const enabled = groupEnabled || tableSummary.activeOrderCount > 0
          return {
            table: t,
            summary: tableSummary,
            enabled,
          }
        })

        merged.push({
          groupId: groupInfo.anchorTableId,
          anchorTableNum: groupInfo.anchorTableNum,
          groupInfo,
          groupSummary,
          tables: tableItems,
        })
      } else {
        processedTableIds.add(table.TABLE_ID)
        const tableSummary = summaries.get(table.TABLE_ID) ?? { totalBill: 0, activeOrderCount: 0 }
        const enabled = tableSummary.activeOrderCount > 0
        standalone.push({
          table,
          groupInfo,
          summary: tableSummary,
          enabled,
        })
      }
    }

    // Sort merge groups by their anchor table number ascending
    merged.sort((a, b) => a.anchorTableNum - b.anchorTableNum)

    // Sort standalone tables by their table number ascending
    standalone.sort((a, b) => (a.table.TABLE_NUM || a.table.TABLE_ID) - (b.table.TABLE_NUM || b.table.TABLE_ID))

    return {
      mergedGroups: merged,
      standaloneTables: standalone,
    }
  }, [tables, summaries])

  const selectedTableGroup = useMemo(() => {
    if (!selectedId) return null
    const group = resolveTableGroupByList(selectedId, tables)
    const summary = group.memberTableIds.reduce(
      (result, id) => {
        const item = summaries.get(id)
        return {
          totalBill: result.totalBill + (item?.totalBill ?? 0),
          activeOrderCount: result.activeOrderCount + (item?.activeOrderCount ?? 0),
        }
      },
      { totalBill: 0, activeOrderCount: 0 },
    )
    const anchorTable =
      tables.find((t) => t.TABLE_ID === group.anchorTableId) ||
      tables.find((t) => t.TABLE_ID === selectedId) ||
      null
    return anchorTable ? { table: anchorTable, group, summary } : null
  }, [selectedId, tables, summaries])

  const activeBillRequest = selectedTableGroup
    ? billRequests.find((request) => selectedTableGroup.group.memberTableIds.includes(request.tableId)) ?? null
    : null

  // Pending uncooked orders in kitchen
  const pendingOrders = useMemo(() => {
    return orders.filter((o) => ['REQUESTED', 'VERIFIED', 'PREPARING'].includes(o.orderStatus))
  }, [orders])

  // Dispatcher completion check: table orders can be billed out once all pending meals have been cooked
  const isTableDispatcherDone = useMemo(() => {
    if (orders.length === 0) return false
    const hasUncooked = orders.some((o) => ['REQUESTED', 'VERIFIED', 'PREPARING'].includes(o.orderStatus))
    if (hasUncooked) return false
    return orders.every((o) => ['READY', 'SERVED', 'COMPLETED'].includes(o.orderStatus))
  }, [orders])

  // Active items in current view
  const activeItems = useMemo<Array<{
    orderItemId: string
    orderId: number
    itemId: number
    name: string
    price: number
    orderType: string
    status?: string
    orderStatus?: string
  }>>(() => {
    return orders
      .filter((order) => order.orderStatus !== 'CANCELLED')
      .flatMap((order) =>
        (order.items ?? [])
          .filter((item) => item.status !== 'CANCELLED')
          .map((item) => ({
            orderItemId: String(item.orderItemId),
            orderId: order.orderId,
            itemId: Number(item.itemId) || 0,
            name: item.name ?? `Item #${item.itemId}`,
            price: item.price ?? 0,
            orderType: String(order.orderType),
            status: item.status,
            orderStatus: order.orderStatus,
          })),
      )
  }, [orders])

  const groupedItems = useMemo(() => {
    const grouped = new Map<string, typeof activeItems>()
    activeItems.forEach((item) => {
      const existing = grouped.get(item.name)
      if (existing) {
        existing.push(item)
      } else {
        grouped.set(item.name, [item])
      }
    })
    return Array.from(grouped.entries()).map(([name, items]) => ({ name, items }))
  }, [activeItems])

  // Collapse all groups by default when selected target changes
  useEffect(() => {
    if (selectedTableGroup && groupedItems.length > 0) {
      setDisableAnimation(true)
      const allGroupNames = groupedItems.filter((g) => g.items.length > 1).map((g) => g.name)
      setCollapsedGroups(new Set(allGroupNames))
      setTimeout(() => setDisableAnimation(false), 50)
    }
  }, [selectedTableGroup?.group.anchorTableId, groupedItems])

  // Discount calculation cascade formula: PWD/SENIOR -> CUSTOM (%) -> SPECIFIC (₱)
  function computeItemPricing(item: { price: number }, discount?: ItemDiscount) {
    const p0 = item.price
    let rem = p0

    // Step 1: PWD / SENIOR (Configurable %)
    let dPwdSenior = 0
    if (discount?.pwd) {
      dPwdSenior = p0 * (discountConfig.pwdPercent / 100)
      rem = Math.max(0, rem - dPwdSenior)
    } else if (discount?.senior) {
      dPwdSenior = p0 * (discountConfig.seniorPercent / 100)
      rem = Math.max(0, rem - dPwdSenior)
    }

    // Step 2: CUSTOM (%)
    let dCustom = 0
    if (discount && discount.custom > 0) {
      const pct = Math.min(100, Math.max(0, discount.custom)) / 100
      dCustom = rem * pct
      rem = Math.max(0, rem - dCustom)
    }

    // Step 3: SPECIFIC (₱)
    let dSpecific = 0
    if (discount && discount.specific > 0) {
      dSpecific = Math.min(rem, discount.specific)
      rem = Math.max(0, rem - dSpecific)
    }

    const totalDiscount = dPwdSenior + dCustom + dSpecific
    const finalPrice = Math.max(0, p0 - totalDiscount)

    return {
      originalPrice: p0,
      dPwdSenior,
      dCustom,
      dSpecific,
      totalDiscount,
      finalPrice,
      hasDiscount: totalDiscount > 0,
    }
  }

  // Calculation formulas for subtotal, discounts, VAT, and grand total
  const {
    subtotal,
    pwdCount,
    seniorCount,
    pwdTotal,
    seniorTotal,
    customTotal,
    specificTotal,
    vatAmount,
    total,
  } = useMemo(() => {
    let rawOriginalTotal = 0
    let pwdDiscounts = 0
    let seniorDiscounts = 0
    let customDiscounts = 0
    let specificDiscounts = 0
    let pwdApplied = 0
    let seniorApplied = 0
    let rawFinalTotal = 0

    activeItems.forEach((item) => {
      const discount = itemDiscounts.get(item.orderItemId)
      const computed = computeItemPricing(item, discount)
      rawOriginalTotal += item.price
      rawFinalTotal += computed.finalPrice
      if (discount?.pwd) {
        pwdDiscounts += computed.dPwdSenior
        pwdApplied++
      } else if (discount?.senior) {
        seniorDiscounts += computed.dPwdSenior
        seniorApplied++
      }
      customDiscounts += computed.dCustom
      specificDiscounts += computed.dSpecific
    })

    const baseSubtotal = rawOriginalTotal / 1.05
    const grandTotal = rawFinalTotal
    const afterDiscountSubtotal = grandTotal / 1.05
    const vat = grandTotal - afterDiscountSubtotal

    return {
      subtotal: baseSubtotal,
      pwdCount: pwdApplied,
      seniorCount: seniorApplied,
      pwdTotal: pwdDiscounts / 1.05,
      seniorTotal: seniorDiscounts / 1.05,
      customTotal: customDiscounts / 1.05,
      specificTotal: specificDiscounts / 1.05,
      taxableSubtotal: afterDiscountSubtotal,
      vatAmount: vat,
      total: grandTotal,
    }
  }, [activeItems, itemDiscounts, discountConfig])

  async function selectTable(tableId: number) {
    setError('')
    setSelectedId(tableId)
    selectedIdRef.current = tableId
    setItemDiscounts(new Map())
    setCurrentInvoice(null)
    setIsInvoiceModalOpen(false)
    setIsVoidMode(false)
    setSelectedVoidItemIds(new Set())
    const group = resolveTableGroupByList(tableId, tables)
    try {
      const fetched = await fetchOrdersByTable(group.anchorTableId, ALL_ACTIVE_ORDER_STATUSES, group.memberTableIds)
      setOrders(fetched)
      setSidebarTab('active')
    } catch (err) {
      console.error('[CashierInterface] Failed to fetch orders:', err)
      setOrders([])
      setError("Unable to load this table's orders.")
    }
  }

  function updateItemDiscount(orderItemId: string, field: keyof ItemDiscount, value: boolean | number) {
    setItemDiscounts((prev) => {
      const next = new Map(prev)
      const current = next.get(orderItemId) ?? { pwd: false, senior: false, custom: 0, specific: 0 }
      if (field === 'pwd') {
        const nextVal = Boolean(value)
        next.set(orderItemId, { ...current, pwd: nextVal, senior: nextVal ? false : current.senior })
      } else if (field === 'senior') {
        const nextVal = Boolean(value)
        next.set(orderItemId, { ...current, senior: nextVal, pwd: nextVal ? false : current.pwd })
      } else if (field === 'custom') {
        next.set(orderItemId, { ...current, custom: Number(value) || 0 })
      } else if (field === 'specific') {
        next.set(orderItemId, { ...current, specific: Number(value) || 0 })
      }
      return next
    })
  }

  function updateGroupDiscount(group: typeof groupedItems[0], field: keyof ItemDiscount, value: boolean | number) {
    setItemDiscounts((prev) => {
      const next = new Map(prev)
      const count = group.items.length
      group.items.forEach((item) => {
        const current = next.get(item.orderItemId) ?? { pwd: false, senior: false, custom: 0, specific: 0 }
        if (field === 'pwd') {
          const nextVal = Boolean(value)
          next.set(item.orderItemId, { ...current, pwd: nextVal, senior: nextVal ? false : current.senior })
        } else if (field === 'senior') {
          const nextVal = Boolean(value)
          next.set(item.orderItemId, { ...current, senior: nextVal, pwd: nextVal ? false : current.pwd })
        } else if (field === 'custom') {
          next.set(item.orderItemId, { ...current, custom: Number(value) || 0 })
        } else if (field === 'specific') {
          // If an item has more than 1 quantity, the top field affects the overall item bill:
          // Divide the specific amount evenly across the individual items in the group
          const perItemVal = count > 0 ? (Number(value) || 0) / count : 0
          next.set(item.orderItemId, { ...current, specific: perItemVal })
        }
      })
      return next
    })
  }

  function getGroupDiscount(group: typeof groupedItems[0], field: keyof ItemDiscount): boolean | number {
    if (group.items.length === 0) return field === 'custom' || field === 'specific' ? 0 : false
    if (field === 'specific') {
      let sum = 0
      group.items.forEach((item) => {
        sum += itemDiscounts.get(item.orderItemId)?.specific ?? 0
      })
      return Math.round(sum * 100) / 100
    }
    if (field === 'custom') {
      const firstValue = itemDiscounts.get(group.items[0].orderItemId)?.custom ?? 0
      const allSame = group.items.every((item) => (itemDiscounts.get(item.orderItemId)?.custom ?? 0) === firstValue)
      return allSame ? firstValue : 0
    }
    const firstValue = itemDiscounts.get(group.items[0].orderItemId)?.[field] ?? false
    const allSame = group.items.every((item) => {
      const discount = itemDiscounts.get(item.orderItemId)?.[field] ?? false
      return discount === firstValue
    })
    return allSame ? firstValue : false
  }

  function toggleGroup(name: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  function applyDiscountToAll(field: keyof ItemDiscount, value: boolean | number) {
    setItemDiscounts((prev) => {
      const next = new Map(prev)
      if (field === 'specific') {
        const numVal = Number(value) || 0
        groupedItems.forEach((group) => {
          const count = group.items.length
          const perItemVal = count > 0 ? numVal / count : 0
          group.items.forEach((item) => {
            const current = next.get(item.orderItemId) ?? { pwd: false, senior: false, custom: 0, specific: 0 }
            next.set(item.orderItemId, { ...current, specific: perItemVal })
          })
        })
      } else {
        activeItems.forEach((item) => {
          const current = next.get(item.orderItemId) ?? { pwd: false, senior: false, custom: 0, specific: 0 }
          if (field === 'pwd') {
            const nextVal = Boolean(value)
            next.set(item.orderItemId, { ...current, pwd: nextVal, senior: nextVal ? false : current.senior })
          } else if (field === 'senior') {
            const nextVal = Boolean(value)
            next.set(item.orderItemId, { ...current, senior: nextVal, pwd: nextVal ? false : current.pwd })
          } else if (field === 'custom') {
            next.set(item.orderItemId, { ...current, custom: Number(value) || 0 })
          }
        })
      }
      return next
    })
  }

  function toggleVoidItem(orderItemId: string) {
    setSelectedVoidItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderItemId)) {
        next.delete(orderItemId)
      } else {
        next.add(orderItemId)
      }
      return next
    })
  }

  function toggleGroupVoid(group: typeof groupedItems[0]) {
    const allGroupItemIds = group.items.map((i) => i.orderItemId)
    const isAllGroupSelected = allGroupItemIds.every((id) => selectedVoidItemIds.has(id))
    setSelectedVoidItemIds((prev) => {
      const next = new Set(prev)
      if (isAllGroupSelected) {
        allGroupItemIds.forEach((id) => next.delete(id))
      } else {
        allGroupItemIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function toggleSelectAllVoid() {
    const allActiveItemIds = activeItems.map((i) => i.orderItemId)
    const isAllSelected = allActiveItemIds.length > 0 && allActiveItemIds.every((id) => selectedVoidItemIds.has(id))
    setSelectedVoidItemIds(() => {
      if (isAllSelected) {
        return new Set()
      } else {
        return new Set(allActiveItemIds)
      }
    })
  }

  async function handleConfirmBatchVoid(authorizedStaffCode?: number) {
    if (!selectedTableGroup || selectedVoidItemIds.size === 0) return
    setIsVoiding(true)
    setError('')

    try {
      const orderItemsByOrder = new Map<number, number[]>()
      activeItems.forEach((item) => {
        if (selectedVoidItemIds.has(item.orderItemId)) {
          const list = orderItemsByOrder.get(item.orderId) ?? []
          list.push(Number(item.orderItemId))
          orderItemsByOrder.set(item.orderId, list)
        }
      })

      const anchorId = selectedTableGroup.group.anchorTableId
      const memberIds = selectedTableGroup.group.memberTableIds
      const cashierStaffId = authorizedStaffCode ?? (staff?.codeId ? Number(staff.codeId) : undefined)
      const cashierShiftId = shift?.shiftId ? Number(shift.shiftId) : undefined

      let totalVoided = 0
      for (const [orderId, itemIds] of orderItemsByOrder.entries()) {
        await voidOrderItems(orderId, itemIds, anchorId, memberIds, {
          staffId: cashierStaffId,
          shiftId: cashierShiftId,
          reason: `Staff #${cashierStaffId || ''} voided ${itemIds.length} item(s) for ${selectedTableGroup.group.displayLabel}`,
        })
        totalVoided += itemIds.length
      }

      showToast(`Successfully voided ${totalVoided} item(s).`, 'success')
      setIsVoidMode(false)
      setSelectedVoidItemIds(new Set())
      setIsBatchVoidAuthOpen(false)
      setBatchVoidAuthCode('')

      const updated = await fetchOrdersByTable(anchorId, ALL_ACTIVE_ORDER_STATUSES, memberIds)
      setOrders(updated)
      await load(true)
    } catch (err) {
      console.error('[CashierInterface] Batch void failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to void selected items.')
      showToast('Failed to void selected items.', 'error')
    } finally {
      setIsVoiding(false)
    }
  }

  const handleExecuteBatchVoidWithAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(batchVoidAuthCode.trim())
    if (!batchVoidAuthCode.trim() || isNaN(num) || num <= 0) {
      setBatchVoidAuthError('Please enter a valid staff code.')
      return
    }

    setIsAuthorizingBatchVoid(true)
    setBatchVoidAuthError(null)

    try {
      const authRes = await validateAnyActiveStaffCode(num)
      if (!authRes.valid) {
        setBatchVoidAuthError(authRes.error || 'Invalid or inactive staff code.')
        setIsAuthorizingBatchVoid(false)
        return
      }

      await handleConfirmBatchVoid(num)
    } catch (err) {
      setBatchVoidAuthError(err instanceof Error ? err.message : 'Failed to authorize void.')
    } finally {
      setIsAuthorizingBatchVoid(false)
    }
  }

  const handleOpenVoidModal = (order: Order, initialItemId?: number) => {
    setVoidTargetOrder(order)
    setVoidInitialItemId(initialItemId ?? null)
    setIsVoidModalOpen(true)
  }

  // Cashier authorizes and confirms item/order voiding
  const handleConfirmVoid = async (orderId: number, orderItemIds: number[], staffCode?: string) => {
    if (!selectedTableGroup) return

    const numericStaffId = staffCode ? Number(staffCode) : (staff?.codeId ? Number(staff.codeId) : undefined)

    await voidOrderItems(
      orderId,
      orderItemIds,
      selectedTableGroup.group.anchorTableId,
      selectedTableGroup.group.memberTableIds,
      {
        staffId: numericStaffId,
        shiftId: shift?.shiftId ? Number(shift.shiftId) : undefined,
        reason: `Staff #${numericStaffId || ''} voided ${orderItemIds.length} item(s) for ${selectedTableGroup.group.displayLabel}`,
      },
    )

    showToast(`Voided ${orderItemIds.length} item(s) from Order #${orderId}.`, 'success')

    const updated = await fetchOrdersByTable(
      selectedTableGroup.group.anchorTableId,
      ALL_ACTIVE_ORDER_STATUSES,
      selectedTableGroup.group.memberTableIds,
    )
    setOrders(updated)
    await load(true)
  }

  const handleClearAssistance = useCallback(async (tableId: number) => {
    const previousTables = tables
    const affectedIds = resolveTableGroupByList(tableId, tables).memberTableIds
    setTables((prev) =>
      prev.map((t) =>
        affectedIds.includes(t.TABLE_ID)
          ? { ...t, STATUS: 'OCCUPIED', BILL_OUT_REQUESTED: false }
          : t,
      ),
    )
    try {
      const resolvedIds = await resolveTableAssistance(tableId)
      setTables((prev) =>
        prev.map((t) =>
          resolvedIds.includes(t.TABLE_ID)
            ? { ...t, STATUS: 'OCCUPIED', BILL_OUT_REQUESTED: false }
            : t,
        ),
      )
      showToast('Assistance alert cleared.', 'info')
      void logCashierAction({
        action: 'TABLE_ASSISTANCE_CLEARED',
        entityType: 'TABLE',
        entityId: String(tableId),
        description: `Cleared assistance alert for Table ${tableId}`,
      })
    } catch (err) {
      console.error(err)
      setTables(previousTables)
      showToast('Failed to clear assistance alert.', 'error')
    }
  }, [tables, showToast])

  const handleClearBillOut = useCallback(async (tableId: number) => {
    const previousTables = tables
    const previousRequests = billRequests
    const affectedIds = resolveTableGroupByList(tableId, tables).memberTableIds
    setTables((prev) =>
      prev.map((t) =>
        affectedIds.includes(t.TABLE_ID) ? { ...t, BILL_OUT_REQUESTED: false } : t,
      ),
    )
    setBillRequests((prev) => prev.filter((r) => !affectedIds.includes(r.tableId)))
    try {
      const resolvedIds = await resolveBillOutRequest(tableId)
      setTables((prev) =>
        prev.map((t) =>
          resolvedIds.includes(t.TABLE_ID) ? { ...t, BILL_OUT_REQUESTED: false } : t,
        ),
      )
      showToast('Bill out request cleared.', 'info')
      void logCashierAction({
        action: 'TABLE_BILL_CLEARED',
        entityType: 'TABLE',
        entityId: String(tableId),
        description: `Cleared bill out request for Table ${tableId}`,
      })
    } catch (err) {
      console.error(err)
      setTables(previousTables)
      setBillRequests(previousRequests)
      showToast('Failed to clear bill out request.', 'error')
    }
  }, [billRequests, tables, showToast])

  function handleOpenInvoiceModal() {
    if (!selectedTableGroup || activeItems.length === 0 || !isTableDispatcherDone) return
    setIsInvoiceModalOpen(true)
  }

  async function handleConfirmInvoice() {
    if (!selectedTableGroup || activeItems.length === 0 || !isTableDispatcherDone) return

    if (currentInvoice) {
      showToast(`Invoice #INV-${currentInvoice.INVOICE_ID} is already confirmed.`, 'info')
      setIsInvoiceModalOpen(false)
      return
    }

    setIsConfirmingInvoice(true)
    setError('')
    try {
      const isMerged = selectedTableGroup.group.isMerged
      const mergeGroupNum = isMerged
        ? Number(selectedTableGroup.group.anchorTableNum || selectedTableGroup.group.groupId)
        : null

      const invoiceItems = activeItems.map((item) => {
        const discount = itemDiscounts.get(item.orderItemId)
        const computed = computeItemPricing(item, discount)
        const percent = discount?.pwd || discount?.senior ? 20 : discount?.custom || 0
        const intDiscount = Math.round(computed.dSpecific * 100) / 100
        return {
          itemId: item.itemId,
          name: item.name,
          price: item.price,
          percentDiscount: percent,
          intDiscount,
        }
      })

      const cashierStaffId = staff?.codeId ? Number(staff.codeId) : shift?.staffId ? Number(shift.staffId) : null
      const cashierName = staff?.staffName || shift?.staffName || 'Cashier'

      const newInvoice = await createOrderInvoice({
        tableNum: Number(selectedTableGroup.group.anchorTableNum || selectedTableGroup.table.TABLE_NUM) || 1,
        mergeGroupNum,
        guestCount: Number(selectedTableGroup.table.CURRENT_GUEST_COUNT) || 1,
        cashierStaffId,
        cashierNameStr: cashierName,
        items: invoiceItems,
        subtotal,
        total,
      })

      setCurrentInvoice(newInvoice)
      showToast(`Invoice #INV-${newInvoice.INVOICE_ID} confirmed successfully. Ready for payment.`, 'success')
      void logCashierAction({
        action: 'INVOICE_GENERATED',
        entityType: 'TABLE',
        entityId: String(selectedTableGroup.group.anchorTableId),
        description: `Generated & Confirmed Invoice #INV-${newInvoice.INVOICE_ID} for ${selectedTableGroup.group.displayLabel} (Total: ${money(total)})`,
        metadata: {
          invoice_id: newInvoice.INVOICE_ID,
          total,
          subtotal,
          table_num: newInvoice.TABLE_NUM,
          items_count: invoiceItems.length,
        },
      })
      setIsInvoiceModalOpen(false)
    } catch (err) {
      console.error('[CashierInterface] Invoice confirmation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to confirm invoice. Please try again.')
      showToast('Failed to confirm invoice.', 'error')
    } finally {
      setIsConfirmingInvoice(false)
    }
  }

  function handlePrintInvoicePdf() {
    if (!selectedTableGroup) return
    const invoiceItems = activeItems.map((item) => {
      const discount = itemDiscounts.get(item.orderItemId)
      const computed = computeItemPricing(item, discount)
      const percent = discount?.pwd || discount?.senior ? 20 : discount?.custom || 0
      const intDiscount = Math.round(computed.dSpecific * 100) / 100
      return {
        itemId: item.itemId,
        name: item.name,
        price: item.price,
        percentDiscount: percent,
        intDiscount,
      }
    })
    const cashierName = staff?.staffName || shift?.staffName || 'Cashier'
    const invoicePayload = currentInvoice || {
      TABLE_NUM: Number(selectedTableGroup.group.anchorTableNum || selectedTableGroup.table.TABLE_NUM) || 1,
      MERGE_GROUP_NUM: selectedTableGroup.group.isMerged
        ? Number(selectedTableGroup.group.anchorTableNum || selectedTableGroup.group.groupId)
        : null,
      GUEST_COUNT: Number(selectedTableGroup.table.CURRENT_GUEST_COUNT) || 1,
      SUBTOTAL: subtotal,
      TOTAL: total,
      DATE_GENERATED: new Date().toISOString(),
    }
    generateInvoicePdf(invoicePayload, invoiceItems, cashierName)
    showToast('Invoice PDF generated and downloaded.', 'info')
  }

  async function handleConfirmPayment(
    paymentMethod: 'Card' | 'Cash' | 'Both',
    amountReceived: number,
    changeGiven: number,
  ) {
    if (!selectedTableGroup || !currentInvoice || orders.length === 0) return
    setBusy(true)
    setError('')

    const invoiceId = currentInvoice.INVOICE_ID
    const isMerged = selectedTableGroup.group.isMerged
    const mergeGroupId = isMerged ? (selectedTableGroup.group.anchorTableNum || selectedTableGroup.group.groupId) : null
    const snapshot = buildReceiptSnapshot({
      tableOrders: orders.filter((order) => order.orderStatus !== 'CANCELLED'),
      discountType: 'none',
      customPercent: 0,
      activeBillRequest,
      tableId: selectedTableGroup.group.anchorTableId,
      tableNum: isMerged && mergeGroupId != null ? `Group ${mergeGroupId}` : selectedTableGroup.group.anchorTableNum,
      isMerged,
      mergeGroupId,
    })
    snapshot.paymentMethod = paymentMethod === 'Both' ? 'Cash & Card' : paymentMethod

    const previousTables = tables
    const previousSummaries = summaries
    const previousRequests = billRequests
    const previousOrders = orders
    const previousSelectedId = selectedId
    const memberIds = selectedTableGroup.group.memberTableIds
    const settledTotal = total
    const settledSubtotal = subtotal
    const settledPwdCount = pwdCount
    const settledSeniorCount = seniorCount
    const settledCustomTotal = customTotal
    const settledOrdersCount = orders.length
    const settledOrderIds = orders.map((o) => o.orderId)
    const anchorId = selectedTableGroup.group.anchorTableId
    const tableNums = selectedTableGroup.group.memberTableNums

    setOrders([])
    setItemDiscounts(new Map())
    setBillRequests((prev) => prev.filter((request) => !memberIds.includes(request.tableId)))
    setTables((prev) =>
      prev.map((table) =>
        memberIds.includes(table.TABLE_ID)
          ? { ...table, STATUS: 'AVAILABLE', CURRENT_GUEST_COUNT: 0, BILL_OUT_REQUESTED: false }
          : table,
      ),
    )
    setSummaries((prev) => {
      const next = new Map(prev)
      memberIds.forEach((id) => next.set(id, { totalBill: 0, activeOrderCount: 0 }))
      return next
    })
    setSelectedId(null)
    selectedIdRef.current = null
    setCurrentInvoice(null)

    try {
      // 1. Create Order_Receipts record
      const receiptRecord = await createOrderReceipt({
        invoiceId,
        paymentType: paymentMethod,
        amountReceived,
        changeGiven,
      })

      snapshot.receiptId = String(receiptRecord.RECEIPT_ID)

      const cashierName = staff?.staffName || shift?.staffName || 'Cashier'
      // 2. Settle orders and link to system_history.Order_History with INVOICE_ID and RECEIPT_ID
      await settleTableOrders(selectedTableGroup.group.anchorTableId, memberIds, {
        shiftId: shift?.shiftId ?? null,
        staffId: shift?.staffId ?? null,
        cashierName,
        paymentMethod,
        invoiceId,
        receiptId: receiptRecord.RECEIPT_ID,
      })

      if (activeBillRequest) await updateBillRequestStatus(activeBillRequest.requestId, 'PAID')
      await resolveBillOutRequest(selectedTableGroup.group.anchorTableId)

      void import('@/services/cashierShiftService').then((m) => m.recordCashierSettlement(settledTotal))

      setReceipt(snapshot)
      await load(true)

      void logCashierAction({
        action: 'PAYMENT_COMPLETED',
        entityType: 'TABLE',
        entityId: String(anchorId),
        description: `Settled bill for Table ${tableNums.join(' + ')} (${money(settledTotal)}) via ${paymentMethod}. Receipt #${receiptRecord.RECEIPT_ID}`,
        metadata: {
          anchor_table_id: anchorId,
          member_table_ids: memberIds,
          table_nums: tableNums,
          total: settledTotal,
          subtotal: settledSubtotal,
          pwd_count: settledPwdCount,
          senior_count: settledSeniorCount,
          custom_discount: settledCustomTotal,
          orders_count: settledOrdersCount,
          order_ids: settledOrderIds,
          payment_method: paymentMethod,
          invoice_id: invoiceId,
          receipt_id: receiptRecord.RECEIPT_ID,
          amount_received: amountReceived,
          change_given: changeGiven,
        },
      })
    } catch (err) {
      console.error('[CashierInterface] Settlement failed:', err)
      setTables(previousTables)
      setSummaries(previousSummaries)
      setBillRequests(previousRequests)
      setOrders(previousOrders)
      setItemDiscounts(new Map())
      setSelectedId(previousSelectedId)
      selectedIdRef.current = previousSelectedId
      setError(err instanceof Error ? err.message : 'Unable to complete bill-out. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (isVoidModalOpen || receipt || busyRef.current || isPaymentModalOpen) return
    const target = e.target as HTMLElement
    if (
      !target.closest('.ci-table-card') &&
      !target.closest('.cashier-sidebar') &&
      !target.closest('button') &&
      !target.closest('input')
    ) {
      if (selectedIdRef.current !== null) {
        setSelectedId(null)
        setOrders([])
        setCurrentInvoice(null)
      }
    }
  }

  return (
    <div className="cashier-interface-page staff-page relative" id="cashier-interface-root" onClick={handleBackgroundClick}>

      {error && <div className="ci-error">{error}</div>}
      <div className="cashier-interface-layout">
        <section className="inner-cashier-container">
          {/* Cashier Shift Status & End Shift Header */}
          <CashierShiftHeaderBar className="mb-3" />

          {/* Table Alerts Banner (Assistance & Bill Out) matching Service Interface */}
          <TableAlertsBanner
            tables={tables}
            billRequests={billRequests}
            onSelectTable={(tableId) => {
              void selectTable(tableId)
              showToast(`Selected Table ${tableId}`, 'info')
            }}
            onClearAssistance={handleClearAssistance}
            onClearBillOut={handleClearBillOut}
            className="mb-3"
          />

          {/* Tables Hierarchy */}
          <div className="ci-tables-wrapper">
            {/* 1. Merge Groups appear FIRST in hierarchy */}
            {mergedGroups.map((groupItem) => (
              <fieldset
                key={`cashier-group-${groupItem.groupId}`}
                className="ci-table-group-container"
              >
                <legend className="ci-table-group-legend">
                  <GitMerge className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Table Group</span>
                </legend>
                <div className="ci-table-group-grid">
                  {groupItem.tables.map(({ table, enabled }) => {
                    const isCardSelected = selectedId === table.TABLE_ID
                    const isGroupMemberSelected =
                      !isCardSelected &&
                      Boolean(selectedTableGroup?.group.memberTableIds.includes(table.TABLE_ID))

                    return (
                      <button
                        key={table.TABLE_ID}
                        type="button"
                        disabled={!enabled}
                        className={`ci-table-card ${enabled ? '' : 'is-disabled'} ${
                          isCardSelected ? 'is-selected' : isGroupMemberSelected ? 'is-group-selected' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          void selectTable(table.TABLE_ID)
                        }}
                      >
                        <div className="ci-table-center">
                          <span className="font-black text-base text-[#14274E]">
                            Table {table.TABLE_NUM || table.TABLE_ID}
                          </span>
                        </div>
                        <div
                          className={`tm-pax-row ${
                            table.CURRENT_GUEST_COUNT >= table.GUEST_CAPACITY ? 'tm-pax-full' : ''
                          }`}
                        >
                          <Users className="ci-icon" />
                          <span>
                            {table.CURRENT_GUEST_COUNT}/{table.GUEST_CAPACITY}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            ))}

            {/* 2. Standalone Tables Grid */}
            {standaloneTables.length > 0 && (
              <div className="ci-table-grid">
                {standaloneTables.map(({ table, enabled }) => {
                  const isSelected = selectedId === table.TABLE_ID
                  return (
                    <button
                      key={table.TABLE_ID}
                      type="button"
                      disabled={!enabled}
                      className={`ci-table-card ${enabled ? '' : 'is-disabled'} ${
                        isSelected ? 'is-selected' : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        void selectTable(table.TABLE_ID)
                      }}
                    >
                      <div className="ci-table-center">
                        <span className="font-black text-base text-[#14274E]">
                          Table {table.TABLE_NUM || table.TABLE_ID}
                        </span>
                      </div>
                      <div
                        className={`tm-pax-row ${
                          table.CURRENT_GUEST_COUNT >= table.GUEST_CAPACITY ? 'tm-pax-full' : ''
                        }`}
                      >
                        <Users className="ci-icon" />
                        <span>
                          {table.CURRENT_GUEST_COUNT}/{table.GUEST_CAPACITY}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {mergedGroups.length === 0 && standaloneTables.length === 0 && (
              <div className="ci-empty">No tables available.</div>
            )}
          </div>
        </section>

        {/* Sidebar Panel */}
        <aside className="cashier-sidebar" onClick={(e) => e.stopPropagation()}>
          <header className="ci-sidebar-header">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-[#14274E] flex items-center gap-2">
                {selectedTableGroup
                  ? selectedTableGroup.group.displayLabel
                  : 'Select a table'}
                {selectedTableGroup?.group.isMerged && (
                  <span className="ci-merged-badge text-[10px]">
                    <GitMerge className="w-3 h-3" />
                    Merged ({selectedTableGroup.group.memberTableNums.length} Tables)
                  </span>
                )}
              </h2>
              {selectedTableGroup && (
                <div className="text-xs font-bold text-slate-500 mt-1">
                  {activeItems.length > 0 && activeItems[0].orderType === 'TAKEOUT' ? 'Take Out' : 'Dine In'}
                </div>
              )}
            </div>
          </header>

          <div className="ci-sidebar-body">
            {!selectedTableGroup ? (
              <div className="ci-sidebar-empty">Select an enabled table card to review its completed order.</div>
            ) : (
              <>
                {/* 2 Tabs: Active (Served/Completed orders) vs Pending (Uncooked orders) */}
                <div className="flex border-b border-slate-200 mb-3 bg-slate-50/70 p-1 rounded-2xl gap-1">
                  <button
                    type="button"
                    onClick={() => setSidebarTab('active')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sidebarTab === 'active'
                        ? 'bg-[#14274E] text-[#D6A75C] shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active</span>
                    {activeItems.length > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          sidebarTab === 'active'
                            ? 'bg-[#D6A75C] text-[#14274E]'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {activeItems.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSidebarTab('pending')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sidebarTab === 'pending'
                        ? 'bg-[#14274E] text-[#D6A75C] shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pending</span>
                    {pendingOrders.length > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          sidebarTab === 'pending'
                            ? 'bg-[#D6A75C] text-[#14274E]'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pendingOrders.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* ── TAB 1: ACTIVE (Served orders ready to be billed out) ── */}
                {sidebarTab === 'active' && (
                  <>
                    {activeItems.length === 0 ? (
                      <div className="ci-sidebar-empty">No completed items to bill.</div>
                    ) : isVoidMode ? (
                        /* ── Void Mode Checklist UI ── */
                        <div className="ci-items-table">
                          <div className="ci-items-header ci-void-header">
                            <span className="text-xs font-black text-rose-700 tracking-wider">
                              ITEMS TO VOID
                            </span>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-rose-700 select-none">
                              <span>Select All</span>
                              <input
                                type="checkbox"
                                className="w-4 h-4 accent-rose-600 cursor-pointer"
                                checked={
                                  activeItems.length > 0 &&
                                  activeItems.every((it) => selectedVoidItemIds.has(it.orderItemId))
                                }
                                onChange={toggleSelectAllVoid}
                              />
                            </label>
                          </div>

                          <div className="ci-items-body">
                            {groupedItems.map((group, groupIndex) => {
                              const isCollapsed = collapsedGroups.has(group.name)
                              const isMultiple = group.items.length > 1

                              const nameParts = group.name.split(' ')
                              const counter = isMultiple ? `x${group.items.length}` : ''
                              let displayName = group.name
                              let displayCounter = counter

                              if (isMultiple && nameParts.length > 1) {
                                const lastWord = nameParts[nameParts.length - 1]
                                displayName = nameParts.slice(0, -1).join(' ')
                                displayCounter = `${lastWord} ${counter}`
                              }

                              if (!isMultiple) {
                                const item = group.items[0]
                                const isSelected = selectedVoidItemIds.has(item.orderItemId)
                                return (
                                  <div key={group.name} className="ci-item-group">
                                    <div
                                      className={`ci-item-row ci-void-row ${
                                        groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
                                      } ${isSelected ? 'is-void-selected' : ''}`}
                                      onClick={() => toggleVoidItem(item.orderItemId)}
                                    >
                                      <div className="ci-col-name">
                                        <span
                                          className="ci-collapse-btn invisible pointer-events-none select-none"
                                          aria-hidden="true"
                                        >
                                          <ChevronRight className="ci-icon-sm" />
                                        </span>
                                        <span className="truncate">{group.name}</span>
                                      </div>
                                      <div
                                        className="ci-void-checkbox-container"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleVoidItem(item.orderItemId)}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )
                              }

                              // Multiple items
                              const allGroupSelected = group.items.every((it) =>
                                selectedVoidItemIds.has(it.orderItemId),
                              )
                              const someGroupSelected = group.items.some((it) =>
                                selectedVoidItemIds.has(it.orderItemId),
                              )

                              return (
                                <div key={group.name} className="ci-item-group">
                                  <div
                                    className={`ci-item-row ci-void-row ${
                                      isMultiple && isCollapsed ? 'ci-collapsed-row' : ''
                                    } ${isMultiple && !isCollapsed ? 'ci-item-group-header' : ''} ${
                                      groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
                                    } ${allGroupSelected ? 'is-void-selected' : ''}`}
                                  >
                                    <div className="ci-col-name">
                                      <button
                                        type="button"
                                        className="ci-collapse-btn"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleGroup(group.name)
                                        }}
                                      >
                                        {isCollapsed ? (
                                          <ChevronRight className="ci-icon-sm" />
                                        ) : (
                                          <ChevronDown className="ci-icon-sm" />
                                        )}
                                      </button>
                                      <span className="truncate">
                                        {displayName} {displayCounter}
                                      </span>
                                    </div>
                                    <div className="ci-void-checkbox-container">
                                      <input
                                        type="checkbox"
                                        checked={allGroupSelected}
                                        ref={(el) => {
                                          if (el) el.indeterminate = someGroupSelected && !allGroupSelected
                                        }}
                                        onChange={() => toggleGroupVoid(group)}
                                      />
                                    </div>
                                  </div>

                                  <div
                                    className={`ci-subrows-container ${
                                      !isCollapsed ? 'expanded' : ''
                                    } ${disableAnimation ? 'no-animation' : ''}`}
                                  >
                                    <div className="ci-subrows-inner">
                                      {group.items.map((item, itemIndex) => {
                                        const isItemSelected = selectedVoidItemIds.has(item.orderItemId)
                                        return (
                                          <div
                                            key={item.orderItemId}
                                            className={`ci-item-row ci-item-subrow ci-void-row ${
                                              groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
                                            } ${isItemSelected ? 'is-void-selected' : ''}`}
                                            onClick={() => toggleVoidItem(item.orderItemId)}
                                          >
                                            <div className="ci-col-name ci-subitem-name">
                                              <span
                                                className="ci-collapse-btn invisible pointer-events-none select-none"
                                                aria-hidden="true"
                                              >
                                                <ChevronRight className="ci-icon-sm" />
                                              </span>
                                              <span>└ {itemIndex + 1}</span>
                                            </div>
                                            <div
                                              className="ci-void-checkbox-container"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isItemSelected}
                                                onChange={() => toggleVoidItem(item.orderItemId)}
                                              />
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        /* ── Table Mode with Discount Controls ── */
                        <div className="ci-items-table">
                          <div className="ci-items-header">
                            <div className="ci-col-name">
                              <span>Name</span>
                            </div>
                            <div className="ci-col-pwd">
                              <span>PWD ({discountConfig.pwdPercent}%)</span>
                              <input
                                type="radio"
                                name="apply-all-discount"
                                checked={applyAllPwd}
                                onClick={() => {
                                  if (applyAllPwd) {
                                    setApplyAllPwd(false)
                                    applyDiscountToAll('pwd', false)
                                  } else {
                                    setApplyAllPwd(true)
                                    setApplyAllSenior(false)
                                    applyDiscountToAll('senior', false)
                                    applyDiscountToAll('pwd', true)
                                  }
                                }}
                                onChange={() => {}}
                              />
                            </div>
                            <div className="ci-col-senior">
                              <span>Senior ({discountConfig.seniorPercent}%)</span>
                              <input
                                type="radio"
                                name="apply-all-discount"
                                checked={applyAllSenior}
                                onClick={() => {
                                  if (applyAllSenior) {
                                    setApplyAllSenior(false)
                                    applyDiscountToAll('senior', false)
                                  } else {
                                    setApplyAllSenior(true)
                                    setApplyAllPwd(false)
                                    applyDiscountToAll('pwd', false)
                                    applyDiscountToAll('senior', true)
                                  }
                                }}
                                onChange={() => {}}
                              />
                            </div>
                            <div className="ci-col-custom">
                              <span>%</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="ci-num-input"
                                value={applyAllCustom || ''}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0
                                  setApplyAllCustom(val)
                                  applyDiscountToAll('custom', val)
                                }}
                              />
                            </div>
                            <div className="ci-col-specific">
                              <span>₱</span>
                              <input
                                type="number"
                                min="0"
                                className="ci-num-input"
                                value={applyAllSpecific || ''}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0
                                  setApplyAllSpecific(val)
                                  applyDiscountToAll('specific', val)
                                }}
                              />
                            </div>
                            <div className="ci-col-price">
                              <span>Price</span>
                            </div>
                          </div>

                          <div className="ci-items-body">
                            {groupedItems.map((group, groupIndex) => {
                              const isCollapsed = collapsedGroups.has(group.name)
                              const isMultiple = group.items.length > 1

                              // Split name and counter for proper wrapping
                              const nameParts = group.name.split(' ')
                              const counter = isMultiple ? `x${group.items.length}` : ''
                              let displayName = group.name
                              let displayCounter = counter

                              if (isMultiple && nameParts.length > 1) {
                                const lastWord = nameParts[nameParts.length - 1]
                                displayName = nameParts.slice(0, -1).join(' ')
                                displayCounter = `${lastWord} ${counter}`
                              }

                              // Single item
                              if (!isMultiple) {
                                const item = group.items[0]
                                const discount = itemDiscounts.get(item.orderItemId) ?? {
                                  pwd: false,
                                  senior: false,
                                  custom: 0,
                                  specific: 0,
                                }
                                const computed = computeItemPricing(item, discount)
                                return (
                                  <div key={group.name} className="ci-item-group">
                                    <div
                                      className={`ci-item-row ${
                                        groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
                                      }`}
                                    >
                                      <div className="ci-col-name">
                                        {/* Invisible placeholder chevron so name stays aligned with dropdowns */}
                                        <span
                                          className="ci-collapse-btn invisible pointer-events-none select-none"
                                          aria-hidden="true"
                                        >
                                          <ChevronRight className="ci-icon-sm" />
                                        </span>
                                        <span className="truncate">{group.name}</span>
                                      </div>
                                      <div className="ci-col-pwd">
                                        <input
                                          type="radio"
                                          name={`discount-${item.orderItemId}`}
                                          checked={discount.pwd}
                                          onClick={() => {
                                            updateItemDiscount(item.orderItemId, 'pwd', !discount.pwd)
                                          }}
                                          onChange={() => {}}
                                        />
                                      </div>
                                      <div className="ci-col-senior">
                                        <input
                                          type="radio"
                                          name={`discount-${item.orderItemId}`}
                                          checked={discount.senior}
                                          onClick={() => {
                                            updateItemDiscount(item.orderItemId, 'senior', !discount.senior)
                                          }}
                                          onChange={() => {}}
                                        />
                                      </div>
                                      <div className="ci-col-custom">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          className="ci-num-input"
                                          value={discount.custom || ''}
                                          placeholder="0"
                                          onChange={(e) =>
                                            updateItemDiscount(
                                              item.orderItemId,
                                              'custom',
                                              Number(e.target.value) || 0,
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="ci-col-specific">
                                        <input
                                          type="number"
                                          min="0"
                                          className="ci-num-input"
                                          value={discount.specific ? (Number.isInteger(discount.specific) ? discount.specific : Number(discount.specific.toFixed(2))) : ''}
                                          placeholder="0"
                                          onChange={(e) =>
                                            updateItemDiscount(
                                              item.orderItemId,
                                              'specific',
                                              Number(e.target.value) || 0,
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="ci-col-price">
                                        {computed.hasDiscount ? (
                                          <>
                                            <span className="text-[10px] text-slate-400 line-through">
                                              {money(computed.originalPrice)}
                                            </span>
                                            <span className="text-emerald-700 font-extrabold">
                                              {money(computed.finalPrice)}
                                            </span>
                                          </>
                                        ) : (
                                          money(computed.originalPrice)
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              }

                              // Multiple items - render as collapsible group
                              const groupCustom = Number(getGroupDiscount(group, 'custom'))
                              const groupSpecific = Number(getGroupDiscount(group, 'specific'))

                              let groupOriginalTotal = 0
                              let groupFinalTotal = 0
                              let groupHasDiscount = false
                              group.items.forEach((it) => {
                                const d = itemDiscounts.get(it.orderItemId)
                                const c = computeItemPricing(it, d)
                                groupOriginalTotal += c.originalPrice
                                groupFinalTotal += c.finalPrice
                                if (c.hasDiscount) groupHasDiscount = true
                              })

                              return (
                                <div key={group.name} className="ci-item-group">
                                  <div
                                    className={`ci-item-row ${
                                      isMultiple && isCollapsed ? 'ci-collapsed-row' : ''
                                    } ${isMultiple && !isCollapsed ? 'ci-item-group-header' : ''} ${
                                      groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
                                    }`}
                                  >
                                    <div className="ci-col-name">
                                      {isMultiple && (
                                        <button
                                          type="button"
                                          className="ci-collapse-btn"
                                          onClick={() => toggleGroup(group.name)}
                                        >
                                          {isCollapsed ? (
                                            <ChevronRight className="ci-icon-sm" />
                                          ) : (
                                            <ChevronDown className="ci-icon-sm" />
                                          )}
                                        </button>
                                      )}
                                      <span className="truncate">
                                        {isMultiple ? (
                                          <>
                                            {displayName} {displayCounter}
                                          </>
                                        ) : (
                                          group.name
                                        )}
                                      </span>
                                    </div>
                                    <div className="ci-col-pwd">
                                      <input
                                        type="radio"
                                        name={`discount-group-${group.name}`}
                                        checked={Boolean(getGroupDiscount(group, 'pwd'))}
                                        onClick={() => {
                                          const current = Boolean(getGroupDiscount(group, 'pwd'))
                                          updateGroupDiscount(group, 'pwd', !current)
                                        }}
                                        onChange={() => {}}
                                      />
                                    </div>
                                    <div className="ci-col-senior">
                                      <input
                                        type="radio"
                                        name={`discount-group-${group.name}`}
                                        checked={Boolean(getGroupDiscount(group, 'senior'))}
                                        onClick={() => {
                                          const current = Boolean(getGroupDiscount(group, 'senior'))
                                          updateGroupDiscount(group, 'senior', !current)
                                        }}
                                        onChange={() => {}}
                                      />
                                    </div>
                                    <div className="ci-col-custom">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="ci-num-input"
                                        value={groupCustom || ''}
                                        placeholder="0"
                                        onChange={(e) =>
                                          updateGroupDiscount(
                                            group,
                                            'custom',
                                            Number(e.target.value) || 0,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="ci-col-specific">
                                      <input
                                        type="number"
                                        min="0"
                                        className="ci-num-input"
                                        value={groupSpecific || ''}
                                        placeholder="0"
                                        onChange={(e) =>
                                          updateGroupDiscount(
                                            group,
                                            'specific',
                                            Number(e.target.value) || 0,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="ci-col-price">
                                      {groupHasDiscount ? (
                                        <>
                                          <span className="text-[10px] text-slate-400 line-through">
                                            {money(groupOriginalTotal)}
                                          </span>
                                          <span className="text-emerald-700 font-extrabold">
                                            {money(groupFinalTotal)}
                                          </span>
                                        </>
                                      ) : (
                                        money(groupOriginalTotal)
                                      )}
                                    </div>
                                  </div>

                                  <div
                                    className={`ci-subrows-container ${
                                      !isCollapsed ? 'expanded' : ''
                                    } ${disableAnimation ? 'no-animation' : ''}`}
                                  >
                                    <div className="ci-subrows-inner">
                                      {group.items.map((item, itemIndex) => {
                                        const discount = itemDiscounts.get(item.orderItemId) ?? {
                                          pwd: false,
                                          senior: false,
                                          custom: 0,
                                          specific: 0,
                                        }
                                        const computed = computeItemPricing(item, discount)
                                        return (
                                          <div
                                            key={item.orderItemId}
                                            className={`ci-item-row ci-item-subrow ${
                                              groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
                                            }`}
                                          >
                                            <div className="ci-col-name ci-subitem-name">
                                              {/* Invisible chevron to keep item name perfectly aligned */}
                                              <span
                                                className="ci-collapse-btn invisible pointer-events-none select-none"
                                                aria-hidden="true"
                                              >
                                                <ChevronRight className="ci-icon-sm" />
                                              </span>
                                              <span>└ {itemIndex + 1}</span>
                                            </div>
                                            <div className="ci-col-pwd">
                                              <input
                                                type="radio"
                                                name={`discount-${item.orderItemId}`}
                                                checked={discount.pwd}
                                                onClick={() => {
                                                  updateItemDiscount(
                                                    item.orderItemId,
                                                    'pwd',
                                                    !discount.pwd,
                                                  )
                                                }}
                                                onChange={() => {}}
                                              />
                                            </div>
                                            <div className="ci-col-senior">
                                              <input
                                                type="radio"
                                                name={`discount-${item.orderItemId}`}
                                                checked={discount.senior}
                                                onClick={() => {
                                                  updateItemDiscount(
                                                    item.orderItemId,
                                                    'senior',
                                                    !discount.senior,
                                                  )
                                                }}
                                                onChange={() => {}}
                                              />
                                            </div>
                                            <div className="ci-col-custom">
                                              <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="ci-num-input"
                                                value={discount.custom || ''}
                                                placeholder="0"
                                                onChange={(e) =>
                                                  updateItemDiscount(
                                                    item.orderItemId,
                                                    'custom',
                                                    Number(e.target.value) || 0,
                                                  )
                                                }
                                              />
                                            </div>
                                            <div className="ci-col-specific">
                                              <input
                                                type="number"
                                                min="0"
                                                className="ci-num-input"
                                                value={discount.specific ? (Number.isInteger(discount.specific) ? discount.specific : Number(discount.specific.toFixed(2))) : ''}
                                                placeholder="0"
                                                onChange={(e) =>
                                                  updateItemDiscount(
                                                    item.orderItemId,
                                                    'specific',
                                                    Number(e.target.value) || 0,
                                                  )
                                                }
                                              />
                                            </div>
                                            <div className="ci-col-price">
                                              {computed.hasDiscount ? (
                                                <>
                                                  <span className="text-[10px] text-slate-400 line-through">
                                                    {money(computed.originalPrice)}
                                                  </span>
                                                  <span className="text-emerald-700 font-extrabold">
                                                    {money(computed.finalPrice)}
                                                  </span>
                                                </>
                                              ) : (
                                                money(computed.originalPrice)
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                  </>
                )}

                {/* ── TAB 2: PENDING (Uncooked order set) ── */}
                {sidebarTab === 'pending' && (
                  <div className="space-y-3">
                    {pendingOrders.length === 0 ? (
                      <div className="p-6 text-center rounded-2xl bg-emerald-50/60 border border-emerald-200/60 space-y-2 my-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                        <h4 className="text-xs font-black text-emerald-900">
                          All meals cooked & served
                        </h4>
                        <p className="text-[11px] text-emerald-700">
                          No pending uncooked orders. Table is ready for billing.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-800 px-1">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Uncooked Orders ({pendingOrders.length})
                          </span>
                        </div>
                        {pendingOrders.map((ord) => {
                          const hasVoidableItems = (ord.items ?? []).some(
                            (i) =>
                              i.status !== 'CANCELLED' &&
                              i.status !== 'READY' &&
                              i.status !== 'SERVED',
                          )
                          return (
                            <div
                              key={ord.orderId}
                              className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs shadow-2xs space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-slate-900">
                                    Order #{ord.orderId}
                                  </span>
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                                    {ord.orderStatus}
                                  </span>
                                </div>
                                {hasVoidableItems && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenVoidModal(ord)}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Void order"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Void</span>
                                  </button>
                                )}
                              </div>
                              <div className="space-y-1 pt-1.5 border-t border-amber-200/50">
                                {(ord.items ?? []).map((it, idx) => (
                                  <div
                                    key={it.orderItemId || idx}
                                    className="flex justify-between text-[11px] text-slate-700"
                                  >
                                    <span className="font-medium">
                                      {it.name ?? `Item #${it.itemId}`}
                                    </span>
                                    <span className="font-bold text-amber-800">
                                      {it.status || ord.orderStatus}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <footer className="ci-sidebar-footer">
            {isVoidMode ? (
              /* ── Void Mode Actions ── */
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200 text-xs">
                  <span className="font-bold text-slate-700">Selected for void:</span>
                  <span className="font-extrabold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                    {selectedVoidItemIds.size} {selectedVoidItemIds.size === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsVoidMode(false)
                      setSelectedVoidItemIds(new Set())
                    }}
                    className="w-full py-2.5 px-3 rounded-2xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedVoidItemIds.size === 0 || isVoiding}
                    onClick={() => {
                      setBatchVoidAuthCode('')
                      setBatchVoidAuthError(null)
                      setIsBatchVoidAuthOpen(true)
                    }}
                    className="w-full py-2.5 px-3 rounded-2xl text-xs font-black bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>{isVoiding ? 'Voiding...' : `Confirm Void (${selectedVoidItemIds.size})`}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ── Normal Billing Summary & Actions ── */
              <>
                <div className="ci-total-row">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                {pwdCount > 0 && (
                  <div className="ci-total-row ci-discount-total">
                    <span>PWD Discounts ({discountConfig.pwdPercent}%) ({pwdCount})</span>
                    <span>-{money(pwdTotal)}</span>
                  </div>
                )}
                {seniorCount > 0 && (
                  <div className="ci-total-row ci-discount-total">
                    <span>Senior Discounts ({discountConfig.seniorPercent}%) ({seniorCount})</span>
                    <span>-{money(seniorTotal)}</span>
                  </div>
                )}
                {customTotal > 0 && (
                  <div className="ci-total-row ci-discount-total">
                    <span>Custom (%) Discounts</span>
                    <span>-{money(customTotal)}</span>
                  </div>
                )}
                {specificTotal > 0 && (
                  <div className="ci-total-row ci-discount-total">
                    <span>Specific (₱) Discounts</span>
                    <span>-{money(specificTotal)}</span>
                  </div>
                )}
                <div className="ci-total-row">
                  <span>VAT (5%)</span>
                  <span>{money(vatAmount)}</span>
                </div>
                <div className="ci-grand-total">
                  <span>Total</span>
                  <strong>{money(total)}</strong>
                </div>

                {/* "Void Orders" button and Billing Actions */}
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    disabled={!selectedTableGroup || activeItems.length === 0 || busy}
                    onClick={() => {
                      setIsVoidMode(true)
                      setSelectedVoidItemIds(new Set())
                    }}
                    className="w-full py-2 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border border-rose-200 text-rose-600 bg-rose-50/70 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Void Orders</span>
                  </button>

                  <div className="ci-action-buttons grid grid-cols-2 gap-2">
                    {/* 1. Generate Invoice Button */}
                    <div
                      className="w-full"
                      title={
                        !selectedTableGroup || activeItems.length === 0
                          ? 'Select a table with items to bill out'
                          : !isTableDispatcherDone
                            ? 'Cannot bill out: Pending orders are still being prepared in the kitchen.'
                            : currentInvoice
                              ? 'View and print customer invoice'
                              : 'Generate and review customer invoice'
                      }
                    >
                      <button
                        type="button"
                        disabled={
                          !selectedTableGroup ||
                          activeItems.length === 0 ||
                          !isTableDispatcherDone ||
                          busy
                        }
                        onClick={handleOpenInvoiceModal}
                        className={`w-full py-2.5 px-2 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          !selectedTableGroup ||
                          activeItems.length === 0 ||
                          !isTableDispatcherDone ||
                          busy
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                            : currentInvoice
                              ? 'bg-[#14274E]/10 text-[#14274E] border border-[#14274E]/30 hover:bg-[#14274E]/20'
                              : 'bg-[#14274E] text-[#D6A75C] hover:bg-[#1a3264] shadow-sm'
                        }`}
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          {currentInvoice
                            ? 'Invoice Ready'
                            : 'Generate Invoice'}
                        </span>
                      </button>
                    </div>

                    {/* 2. Print Receipt Button */}
                    <div
                      className="w-full"
                      title={
                        !selectedTableGroup || activeItems.length === 0
                          ? 'Select a table with items to bill out'
                          : !isTableDispatcherDone
                            ? 'Cannot bill out: Pending orders are still being prepared in the kitchen.'
                            : !currentInvoice
                              ? 'Generate invoice first before printing receipt.'
                              : 'Proceed to payment and print receipt'
                      }
                    >
                      <button
                        type="button"
                        disabled={
                          !selectedTableGroup ||
                          activeItems.length === 0 ||
                          !isTableDispatcherDone ||
                          !currentInvoice ||
                          busy
                        }
                        onClick={() => setIsPaymentModalOpen(true)}
                        className={`w-full py-2.5 px-2 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          !selectedTableGroup ||
                          activeItems.length === 0 ||
                          !isTableDispatcherDone ||
                          !currentInvoice ||
                          busy
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        }`}
                      >
                        <Printer className="w-4 h-4 shrink-0" />
                        <span className="truncate">Print Receipt</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </footer>
        </aside>
      </div>

      {receipt && <ReceiptPreviewModal receipt={receipt} onClose={() => setReceipt(null)} />}
      {!receipt && selectedTableGroup && activeBillRequest && (
        <span className="sr-only">Payment requested via {activeBillRequest.paymentMethod}</span>
      )}

      {/* Cashier-Authorized Void Order / Items Modal */}
      <VoidOrderModal
        isOpen={isVoidModalOpen}
        order={voidTargetOrder}
        tableLabel={selectedTableGroup?.group.displayLabel || 'Table'}
        initialItemId={voidInitialItemId}
        requireStaffCode={true}
        onClose={() => {
          setIsVoidModalOpen(false)
          setVoidTargetOrder(null)
          setVoidInitialItemId(null)
        }}
        onConfirmVoid={handleConfirmVoid}
      />

      {/* Batch Void Staff Code Authorization Modal */}
      {isBatchVoidAuthOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => !isAuthorizingBatchVoid && setIsBatchVoidAuthOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-rose-50/70">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-black text-[#14274E]">
                  Authorize Void ({selectedVoidItemIds.size} Items)
                </h3>
              </div>
              <button
                type="button"
                disabled={isAuthorizingBatchVoid}
                onClick={() => setIsBatchVoidAuthOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteBatchVoidWithAuth} className="p-5 space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                Enter an existing active staff code to authorize voiding{' '}
                <strong>{selectedVoidItemIds.size}</strong> selected item(s).
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Staff Code Authorization <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  disabled={isAuthorizingBatchVoid}
                  value={batchVoidAuthCode}
                  onChange={(e) => {
                    setBatchVoidAuthCode(e.target.value)
                    if (batchVoidAuthError) setBatchVoidAuthError(null)
                  }}
                  placeholder="Enter 4-digit staff code"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/10 outline-none font-mono font-black"
                />
              </div>

              {batchVoidAuthError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {batchVoidAuthError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isAuthorizingBatchVoid}
                  onClick={() => setIsBatchVoidAuthOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthorizingBatchVoid || !batchVoidAuthCode.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {isAuthorizingBatchVoid ? 'Verifying...' : 'Authorize & Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cashier Traditional Invoice Preview & Confirmation Modal */}
      {selectedTableGroup && (
        <CashierInvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          tableLabel={selectedTableGroup.group.displayLabel}
          tableNum={Number(selectedTableGroup.group.anchorTableNum || selectedTableGroup.table.TABLE_NUM) || 1}
          mergeGroupNum={
            selectedTableGroup.group.isMerged
              ? Number(selectedTableGroup.group.anchorTableNum || selectedTableGroup.group.groupId)
              : null
          }
          guestCount={Number(selectedTableGroup.table.CURRENT_GUEST_COUNT) || 1}
          cashierName={staff?.staffName || shift?.staffName || 'Cashier'}
          items={activeItems.map((item) => {
            const discount = itemDiscounts.get(item.orderItemId)
            const computed = computeItemPricing(item, discount)
            const percent = discount?.pwd || discount?.senior ? 20 : discount?.custom || 0
            return {
              itemId: item.itemId,
              name: item.name,
              price: item.price,
              percentDiscount: percent,
              intDiscount: Math.round(computed.dSpecific * 100) / 100,
            }
          })}
          subtotal={subtotal}
          vatAmount={vatAmount}
          total={total}
          invoiceId={currentInvoice?.INVOICE_ID}
          isConfirmed={Boolean(currentInvoice)}
          isConfirming={isConfirmingInvoice}
          onConfirmInvoice={handleConfirmInvoice}
          onPrintPdf={handlePrintInvoicePdf}
        />
      )}

      {/* Cashier Payment Selection & Receipt Settlement Modal */}
      {currentInvoice && (
        <CashierPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          tableLabel={selectedTableGroup?.group.displayLabel || 'Table'}
          totalAmount={total}
          subtotalAmount={subtotal}
          invoiceId={currentInvoice.INVOICE_ID}
          onConfirmPayment={handleConfirmPayment}
        />
      )}
    </div>
  )
}
