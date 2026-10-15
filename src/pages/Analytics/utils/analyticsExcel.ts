import type { AnalyticsSummary } from '@/services/analyticsService'

/**
 * Escapes XML characters for Excel Spreadsheet XML.
 */
function escapeXml(unsafe: string | number | null | undefined): string {
  if (unsafe === null || unsafe === undefined) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generates and downloads a clean, multi-worksheet Excel workbook (.xls)
 * formatted using Microsoft Office XML Spreadsheet format, matching the exact
 * data, KPIs, order sources, item/category rankings, and event revenue in the UI.
 */
export function exportAnalyticsExcel(summary: AnalyticsSummary): void {
  const generatedAt = new Date().toLocaleString('en-US')
  const periodLabel = summary.dateRange.label

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#14274E" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SubHeaderStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#394867" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Color="#14274E" ss:Bold="1"/>
  </Style>
  <Style ss:ID="SubtitleStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#64748B" ss:Italic="1"/>
  </Style>
  <Style ss:ID="KpiLabel">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B" ss:Bold="1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CurrencyCell">
   <NumberFormat ss:Format="&quot;PHP &quot;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="NumberCell">
   <NumberFormat ss:Format="#,##0"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="PercentCell">
   <NumberFormat ss:Format="0.0%"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="BoldText">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
  </Style>
 </Styles>`

  // ── Worksheet 1: Executive Overview ──
  xml += `
 <Worksheet ss:Name="Overview">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="220"/>
   <Column ss:Width="180"/>
   <Row ss:Height="28">
    <Cell ss:MergeAcross="1" ss:StyleID="TitleStyle"><Data ss:Type="String">MONOLITH POS — ANALYTICS REPORT</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="1" ss:StyleID="SubtitleStyle"><Data ss:Type="String">Period: ${escapeXml(periodLabel)} | Generated: ${escapeXml(generatedAt)}</Data></Cell>
   </Row>
   <Row ss:Height="10"/>

   <!-- Primary KPIs -->
   <Row ss:Height="24">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Executive Metric</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Value</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Total Revenue</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${summary.revenue}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Completed Orders</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${summary.completedOrders}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Guests Served</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${summary.customersServed ?? 0}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Average Order Value</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${summary.averageOrderValue}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Items Sold</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${summary.itemsSold}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Cancelled Orders</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${summary.cancelledOrders}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Peak Sales Day</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(summary.peakDay ?? '—')}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Peak Operating Hour</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(summary.peakHour ?? '—')}</Data></Cell>
   </Row>

   <!-- Order Source Channel Distribution -->
   <Row ss:Height="14"/>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="1" ss:StyleID="HeaderStyle"><Data ss:Type="String">Order Source Channel Distribution</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Service Staff Orders (Cashier)</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${summary.orderSourceComparison.service.count}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Service Staff Revenue</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${summary.orderSourceComparison.service.revenue}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Service Staff Share</Data></Cell>
    <Cell ss:StyleID="PercentCell"><Data ss:Type="Number">${summary.orderSourceComparison.service.percentage / 100}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Customer Interface Orders (Table Ordering)</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${summary.orderSourceComparison.customer.count}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Customer Interface Revenue</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${summary.orderSourceComparison.customer.revenue}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Customer Interface Share</Data></Cell>
    <Cell ss:StyleID="PercentCell"><Data ss:Type="Number">${summary.orderSourceComparison.customer.percentage / 100}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>`

  // ── Worksheet 2: Menu Items Sales Ranking ──
  const items = summary.allItems && summary.allItems.length > 0 ? summary.allItems : summary.topItems
  xml += `
 <Worksheet ss:Name="Item Rankings">
  <Table ss:DefaultColumnWidth="120">
   <Column ss:Width="45"/>
   <Column ss:Width="200"/>
   <Column ss:Width="140"/>
   <Column ss:Width="95"/>
   <Column ss:Width="85"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">#</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Item Name</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Unit Price</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Units Sold</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Revenue</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Sales Share</Data></Cell>
   </Row>`

  items.forEach((it, idx) => {
    xml += `
   <Row ss:Height="18">
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">${escapeXml(it.itemName)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(it.categoryName)}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${it.unitPrice}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${it.quantity}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${it.revenue}</Data></Cell>
    <Cell ss:StyleID="PercentCell"><Data ss:Type="Number">${(it.percentageOfSales || 0) / 100}</Data></Cell>
   </Row>`
  })

  xml += `
  </Table>
 </Worksheet>`

  // ── Worksheet 3: Category Rankings ──
  xml += `
 <Worksheet ss:Name="Category Rankings">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="180"/>
   <Column ss:Width="100"/>
   <Column ss:Width="140"/>
   <Column ss:Width="110"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Items Sold</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Revenue</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">% of Total Revenue</Data></Cell>
   </Row>`

  summary.categoryStats.forEach((cat) => {
    xml += `
   <Row ss:Height="18">
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">${escapeXml(cat.categoryName)}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${cat.itemsSold}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${cat.revenue}</Data></Cell>
    <Cell ss:StyleID="PercentCell"><Data ss:Type="Number">${cat.percentageOfRevenue / 100}</Data></Cell>
   </Row>`
  })

  xml += `
  </Table>
 </Worksheet>`

  // ── Worksheet 4: Menu Presets (if any) ──
  if (summary.presetStats && summary.presetStats.length > 0) {
    xml += `
 <Worksheet ss:Name="Menu Presets">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="200"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Preset Name</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Items Sold</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Share of Sales</Data></Cell>
   </Row>`

    summary.presetStats.forEach((preset) => {
      xml += `
   <Row ss:Height="18">
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">${escapeXml(preset.presetName)}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${preset.itemsSold}</Data></Cell>
    <Cell ss:StyleID="PercentCell"><Data ss:Type="Number">${preset.percentageOfSales / 100}</Data></Cell>
   </Row>`
    })

    xml += `
  </Table>
 </Worksheet>`
  }

  // ── Worksheet 5: Events Revenue ──
  if (summary.eventsList && summary.eventsList.length > 0) {
    xml += `
 <Worksheet ss:Name="Events">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="220"/>
   <Column ss:Width="130"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="130"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Event Title</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Date</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Max Pax</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Revenue Earned</Data></Cell>
   </Row>`

    summary.eventsList.forEach((ev) => {
      const dateFormatted = ev.startAt
        ? new Date(ev.startAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—'

      xml += `
   <Row ss:Height="18">
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">${escapeXml(ev.title)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(ev.category)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(dateFormatted)}</Data></Cell>
    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${ev.maxPax}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${ev.revenueEarned}</Data></Cell>
   </Row>`
    })

    xml += `
  </Table>
 </Worksheet>`
  }

  xml += `
</Workbook>`

  // Trigger download as .xls
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStr = summary.dateRange.startDate.toISOString().slice(0, 10)
  link.href = url
  link.download = `Monolith_POS_Analytics_${dateStr}.xls`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
