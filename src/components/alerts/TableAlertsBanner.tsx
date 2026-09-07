import { useState, useMemo } from 'react'
import {
  BellRing,
  Receipt,
  GitMerge,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Droplets,
  UserCheck,
  UtensilsCrossed,
  MessageSquare,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { resolveTableGroupByList, type TableGroupInfo } from '@/services/tableGroupService'
import type { TableData } from '@/services/tableService'
import type { BillRequest } from '@/types/bill'
import {
  getAssistanceRequestForTable,
} from '@/services/assistanceService'
import type { AssistanceRequest } from '@/types/assistance'

export interface TableAlertsBannerProps {
  tables: TableData[] | Array<{
    TABLE_ID: number
    TABLE_NUM: number
    STATUS: string
    GUEST_CAPACITY: number
    CURRENT_GUEST_COUNT: number
    BILL_OUT_REQUESTED: boolean
    MERGE_GROUP_ID?: number | null
  }>
  billRequests?: BillRequest[]
  onSelectTable?: (tableId: number) => void
  onClearAssistance: (tableId: number) => Promise<void> | void
  onClearBillOut: (tableId: number) => Promise<void> | void
  className?: string
}

interface ActiveAlertDetail {
  type: 'ASSISTANCE' | 'BILL_OUT'
  group: TableGroupInfo
  assistanceReq: AssistanceRequest | null
  billReq: BillRequest | null
}

export function TableAlertsBanner({
  tables,
  billRequests = [],
  onSelectTable,
  onClearAssistance,
  onClearBillOut,
  className = '',
}: TableAlertsBannerProps) {
  const [clearingId, setClearingId] = useState<number | null>(null)
  const [activeDetail, setActiveDetail] = useState<ActiveAlertDetail | null>(null)

  const tableList = tables as TableData[]

  // 1. Grouped tables calling for ASSISTANCE (STATUS === 'HAS_REQUEST')
  const assistanceGroups = useMemo(() => {
    const groupsMap = new Map<number, TableGroupInfo>()
    for (const t of tableList) {
      if (t.STATUS === 'HAS_REQUEST') {
        const grp = resolveTableGroupByList(t.TABLE_ID, tableList)
        if (!groupsMap.has(grp.anchorTableId)) {
          groupsMap.set(grp.anchorTableId, grp)
        }
      }
    }
    return Array.from(groupsMap.values()).sort((a, b) => a.anchorTableNum - b.anchorTableNum)
  }, [tableList])

  // 2. Grouped tables requesting BILL OUT (BILL_OUT_REQUESTED === true OR active Bill_Requests)
  const billOutGroups = useMemo(() => {
    const groupsMap = new Map<number, TableGroupInfo>()

    // Check table flag
    for (const t of tableList) {
      if (t.BILL_OUT_REQUESTED) {
        const grp = resolveTableGroupByList(t.TABLE_ID, tableList)
        if (!groupsMap.has(grp.anchorTableId)) {
          groupsMap.set(grp.anchorTableId, grp)
        }
      }
    }

    // Also check active bill requests
    for (const br of billRequests) {
      if (br.status === 'REQUESTED' || br.status === 'PROCESSING') {
        const grp = resolveTableGroupByList(br.tableId, tableList)
        if (!groupsMap.has(grp.anchorTableId)) {
          groupsMap.set(grp.anchorTableId, grp)
        }
      }
    }

    return Array.from(groupsMap.values()).sort((a, b) => a.anchorTableNum - b.anchorTableNum)
  }, [tableList, billRequests])

  if (assistanceGroups.length === 0 && billOutGroups.length === 0) {
    return null
  }

  const handleClearAssistanceClick = async (e: React.MouseEvent, anchorId: number) => {
    e.stopPropagation()
    setClearingId(anchorId)
    try {
      await onClearAssistance(anchorId)
      if (activeDetail?.group.anchorTableId === anchorId) {
        setActiveDetail(null)
      }
    } finally {
      setClearingId(null)
    }
  }

  const handleClearBillOutClick = async (e: React.MouseEvent, anchorId: number) => {
    e.stopPropagation()
    setClearingId(anchorId)
    try {
      await onClearBillOut(anchorId)
      if (activeDetail?.group.anchorTableId === anchorId) {
        setActiveDetail(null)
      }
    } finally {
      setClearingId(null)
    }
  }

  const getBillRequestForGroup = (grp: TableGroupInfo): BillRequest | null => {
    return billRequests.find((r) => grp.memberTableIds.includes(r.tableId)) ?? null
  }

  const getPaymentMethodBadge = (method?: string) => {
    switch (method) {
      case 'CASH':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded-md">
            <Banknote className="w-3 h-3" /> Cash
          </span>
        )
      case 'CREDIT_CARD':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded-md">
            <CreditCard className="w-3 h-3" /> Card
          </span>
        )
      case 'INSTAPAY_QR':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-100/70 px-1.5 py-0.5 rounded-md">
            <QrCode className="w-3 h-3" /> QR
          </span>
        )
      default:
        return null
    }
  }

  const getAssistanceIcon = (type?: string) => {
    switch (type) {
      case 'WATER':
        return <Droplets className="w-3.5 h-3.5 text-blue-500" />
      case 'WAITER':
        return <UserCheck className="w-3.5 h-3.5 text-amber-500" />
      case 'UTENSILS':
        return <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-500" />
      case 'BILL_OUT':
        return <Receipt className="w-3.5 h-3.5 text-purple-500" />
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-rose-500" />
    }
  }

  return (
    <>
      <div className={`flex flex-col gap-2 ${className}`}>
        {/* ── 1. BILL OUT REQUESTS BANNER ── */}
        {billOutGroups.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/90 shadow-xs flex items-center justify-between gap-3 animate-fade-in transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Receipt className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-extrabold text-amber-950">
                    {billOutGroups.length} Dining Session{billOutGroups.length !== 1 ? 's' : ''} Requesting Bill Out
                  </h4>
                </div>
                <div className="text-[0.7rem] text-amber-800 flex items-center gap-1.5 flex-wrap mt-0.5">
                  {billOutGroups.map((grp, idx) => {
                    const bReq = getBillRequestForGroup(grp)
                    return (
                      <span
                        key={grp.anchorTableId}
                        onClick={() =>
                          setActiveDetail({
                            type: 'BILL_OUT',
                            group: grp,
                            assistanceReq: null,
                            billReq: bReq,
                          })
                        }
                        className="inline-flex items-center gap-1 cursor-pointer font-bold hover:underline"
                        title="Click to view details"
                      >
                        {grp.displayLabel}
                        {grp.isMerged && (
                          <GitMerge className="w-2.5 h-2.5 text-amber-700" />
                        )}
                        {bReq && getPaymentMethodBadge(bReq.paymentMethod)}
                        {idx < billOutGroups.length - 1 ? ' • ' : ''}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {billOutGroups.slice(0, 3).map((grp) => {
                const isBusy = clearingId === grp.anchorTableId
                const bReq = getBillRequestForGroup(grp)
                return (
                  <div key={grp.anchorTableId} className="flex items-center gap-1">
                    {onSelectTable && (
                      <button
                        type="button"
                        onClick={() => onSelectTable(grp.anchorTableId)}
                        className="text-[0.68rem] font-extrabold bg-amber-600 text-white px-2 py-1 rounded-lg hover:bg-amber-700 active:scale-95 transition-all whitespace-nowrap shadow-2xs cursor-pointer flex items-center gap-1"
                        title={`Select ${grp.displayLabel} in Cashier`}
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span>Select {grp.shortDisplayLabel}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleClearBillOutClick(e, grp.anchorTableId)}
                      disabled={isBusy}
                      className="text-[0.68rem] font-bold bg-white text-amber-900 border border-amber-300 px-2 py-1 rounded-lg hover:bg-amber-100/60 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
                      title={`Clear bill out alert for ${grp.displayLabel}`}
                    >
                      {isBusy ? (
                        <span className="inline-block w-3 h-3 border border-amber-800 border-t-transparent animate-spin rounded-full" />
                      ) : (
                        `Clear ${grp.shortDisplayLabel}`
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveDetail({
                          type: 'BILL_OUT',
                          group: grp,
                          assistanceReq: null,
                          billReq: bReq,
                        })
                      }
                      className="text-[0.68rem] font-bold text-amber-800 hover:text-amber-950 px-1 py-1 rounded-md hover:bg-amber-100/50"
                      title="View bill out request details"
                    >
                      Details
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 2. ASSISTANCE REQUESTS BANNER ── */}
        {assistanceGroups.length > 0 && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/90 shadow-xs flex items-center justify-between gap-3 animate-fade-in transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <BellRing className="w-3.5 h-3.5 animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-extrabold text-rose-900">
                    {assistanceGroups.length} Table{assistanceGroups.length !== 1 ? 's' : ''} Calling for Assistance
                  </h4>
                </div>
                <div className="text-[0.7rem] text-rose-700 flex items-center gap-1.5 flex-wrap mt-0.5">
                  {assistanceGroups.map((grp, idx) => {
                    const assistReq = getAssistanceRequestForTable(
                      grp.anchorTableId,
                      grp.memberTableIds,
                    )
                    return (
                      <span
                        key={grp.anchorTableId}
                        onClick={() =>
                          setActiveDetail({
                            type: 'ASSISTANCE',
                            group: grp,
                            assistanceReq: assistReq,
                            billReq: null,
                          })
                        }
                        className="inline-flex items-center gap-1 cursor-pointer font-bold hover:underline"
                        title="Click to view details"
                      >
                        {grp.displayLabel}
                        {grp.isMerged && (
                          <GitMerge className="w-2.5 h-2.5 text-rose-700" />
                        )}
                        {assistReq && (
                          <span className="text-[10px] text-rose-600 font-semibold">
                            ({assistReq.title})
                          </span>
                        )}
                        {idx < assistanceGroups.length - 1 ? ' • ' : ''}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {assistanceGroups.slice(0, 3).map((grp) => {
                const isBusy = clearingId === grp.anchorTableId
                const assistReq = getAssistanceRequestForTable(
                  grp.anchorTableId,
                  grp.memberTableIds,
                )
                return (
                  <div key={grp.anchorTableId} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleClearAssistanceClick(e, grp.anchorTableId)}
                      disabled={isBusy}
                      className="text-[0.68rem] font-bold bg-rose-600 text-white px-2.5 py-1 rounded-lg hover:bg-rose-700 active:scale-95 transition-all whitespace-nowrap shadow-2xs cursor-pointer flex items-center gap-1"
                      title={`Clear assistance alert for ${grp.displayLabel}`}
                    >
                      {isBusy ? (
                        <span className="inline-block w-3 h-3 border border-white border-t-transparent animate-spin rounded-full" />
                      ) : (
                        `Clear ${grp.shortDisplayLabel}`
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveDetail({
                          type: 'ASSISTANCE',
                          group: grp,
                          assistanceReq: assistReq,
                          billReq: null,
                        })
                      }
                      className="text-[0.68rem] font-bold text-rose-800 hover:text-rose-950 px-1 py-1 rounded-md hover:bg-rose-100/50"
                      title="View assistance request details"
                    >
                      Details
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. ALERT DETAILS POPUP MODAL ── */}
      {activeDetail && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white ${
                    activeDetail.type === 'BILL_OUT' ? 'bg-amber-600' : 'bg-rose-600'
                  }`}
                >
                  {activeDetail.type === 'BILL_OUT' ? (
                    <Receipt className="w-5 h-5" />
                  ) : (
                    <BellRing className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#14274E] flex items-center gap-1.5">
                    {activeDetail.type === 'BILL_OUT'
                      ? 'Bill Out Request'
                      : 'Table Assistance Call'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-bold text-slate-700">
                      {activeDetail.group.displayLabel}
                    </span>
                    {activeDetail.group.isMerged && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded-full border border-blue-200">
                        <GitMerge className="w-2.5 h-2.5" /> Merged Group
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-4 space-y-3">
              {/* Group info banner */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Dining Session
                  </span>
                  <span className="font-extrabold text-[#14274E]">
                    {activeDetail.group.displayLabel}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                    Total Capacity
                  </span>
                  <span className="font-bold text-slate-700">
                    {activeDetail.group.capacity} Seats ({activeDetail.group.currentGuestCount} Seated)
                  </span>
                </div>
              </div>

              {activeDetail.type === 'BILL_OUT' ? (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                      Payment Preference
                    </span>
                    {getPaymentMethodBadge(activeDetail.billReq?.paymentMethod ?? 'CASH')}
                  </div>
                  {activeDetail.billReq?.requestedAt && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-800">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Requested at{' '}
                        {new Date(activeDetail.billReq.requestedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-amber-900/90 leading-relaxed font-medium">
                    Customer is ready to settle. Review table orders and proceed with payment.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900 uppercase tracking-wide flex items-center gap-1.5">
                      {getAssistanceIcon(activeDetail.assistanceReq?.type)}
                      {activeDetail.assistanceReq?.title ?? 'Service Call'}
                    </span>
                    {activeDetail.assistanceReq?.requestedAt && (
                      <span className="text-[11px] text-rose-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(
                          activeDetail.assistanceReq.requestedAt,
                        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {activeDetail.assistanceReq?.notes ? (
                    <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100 text-xs text-slate-800 italic">
                      "{activeDetail.assistanceReq.notes}"
                    </div>
                  ) : (
                    <p className="text-xs text-rose-800 font-medium">
                      Table has requested staff service or assistance.
                    </p>
                  )}
                </div>
              )}

              {activeDetail.group.isMerged && (
                <p className="text-[11px] text-slate-400 italic">
                  Note: This alert is shared across all tables in this merged group (
                  {activeDetail.group.displayLabel}). Clearing this alert will update all members.
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-5 flex gap-2">
              {onSelectTable && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectTable(activeDetail.group.anchorTableId)
                    setActiveDetail(null)
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#14274E] hover:bg-[#14274E]/90 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Cashier</span>
                </button>
              )}
              <button
                type="button"
                onClick={async (e) => {
                  if (activeDetail.type === 'BILL_OUT') {
                    await handleClearBillOutClick(e, activeDetail.group.anchorTableId)
                  } else {
                    await handleClearAssistanceClick(e, activeDetail.group.anchorTableId)
                  }
                  setActiveDetail(null)
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Clear Alert</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDetail(null)}
                className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
