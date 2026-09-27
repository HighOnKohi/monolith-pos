import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mjwshsrekvaabcfgeizd.supabase.co/'
const supabaseAnonKey = 'sb_publishable_3rhB-vJBi7QE3Ay6Qmuiyw_hkvdof-R'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const TABLE_TYPES = {
  1: { width: 2, height: 2, defaultCapacity: 4 },
  2: { width: 2, height: 4, defaultCapacity: 8 },
  3: { width: 4, height: 2, defaultCapacity: 4 },
  4: { width: 3, height: 3, defaultCapacity: 6 },
}

function areLayoutTablesAdjacent(t1, t2) {
  const cfg1 = TABLE_TYPES[t1.TABLE_TYPE || 1] || TABLE_TYPES[1]
  const cfg2 = TABLE_TYPES[t2.TABLE_TYPE || 1] || TABLE_TYPES[1]

  const aX = Number(t1.X_POS || 0)
  const aY = Number(t1.Y_POS || 0)
  const aW = cfg1.width
  const aH = cfg1.height

  const bX = Number(t2.X_POS || 0)
  const bY = Number(t2.Y_POS || 0)
  const bW = cfg2.width
  const bH = cfg2.height

  const hAdj =
    (aX + aW === bX || bX + bW === aX) &&
    Math.max(aY, bY) < Math.min(aY + aH, bY + bH)

  const vAdj =
    (aY + aH === bY || bY + bH === aY) &&
    Math.max(aX, bX) < Math.min(aX + aW, bX + bW)

  return hAdj || vAdj
}

function sanitizeLayoutMergeGroups(tables) {
  if (tables.length === 0) return []

  const rawGroupMap = new Map()
  for (const t of tables) {
    if (t.MERGE_GROUP_ID != null && Number(t.MERGE_GROUP_ID) > 0) {
      const gid = Number(t.MERGE_GROUP_ID)
      const list = rawGroupMap.get(gid) || []
      list.push(t)
      rawGroupMap.set(gid, list)
    }
  }

  const newMergeGroupIdByNum = new Map()
  for (const t of tables) {
    newMergeGroupIdByNum.set(t.TABLE_NUM, null)
  }

  for (const [, members] of rawGroupMap.entries()) {
    if (members.length < 2) continue

    const mCount = members.length
    const adj = Array.from({ length: mCount }, () => [])
    for (let i = 0; i < mCount; i++) {
      for (let j = i + 1; j < mCount; j++) {
        if (areLayoutTablesAdjacent(members[i], members[j])) {
          adj[i].push(j)
          adj[j].push(i)
        }
      }
    }

    const visited = new Array(mCount).fill(false)

    for (let i = 0; i < mCount; i++) {
      if (!visited[i]) {
        const comp = []
        const queue = [i]
        visited[i] = true

        while (queue.length > 0) {
          const curr = queue.shift()
          comp.push(members[curr])
          for (const neighbor of adj[curr]) {
            if (!visited[neighbor]) {
              visited[neighbor] = true
              queue.push(neighbor)
            }
          }
        }

        if (comp.length >= 2) {
          const anchorTableNum = Math.min(...comp.map((t) => t.TABLE_NUM))
          for (const m of comp) {
            newMergeGroupIdByNum.set(m.TABLE_NUM, anchorTableNum)
          }
        }
      }
    }
  }

  return tables.map((t) => ({
    ...t,
    MERGE_GROUP_ID: newMergeGroupIdByNum.get(t.TABLE_NUM) ?? null,
  }))
}

async function cleanDatabase() {
  console.log('=== STARTING DATABASE CLEANUP ===\n')

  // 1. Fetch all presets
  const { data: presets, error: presetsErr } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .select('*')
    .order('LAYOUT_PRESET_ID', { ascending: true })

  if (presetsErr) throw presetsErr

  let defaultPreset = presets.find((p) => p.IS_DEFAULT) || presets[0]

  // 2. Clean and re-number Table_Layout_Info for EVERY preset sequentially (1..N)
  for (const preset of presets) {
    console.log(`Processing Preset #${preset.LAYOUT_PRESET_ID} "${preset.PRESET_NAME}"...`)
    const { data: rawTables, error: fetchErr } = await supabase
      .schema('tables')
      .from('Table_Layout_Info')
      .select('*')
      .eq('LAYOUT_PRESET_ID', preset.LAYOUT_PRESET_ID)
      .order('TABLE_NUM', { ascending: true })

    if (fetchErr) throw fetchErr
    if (!rawTables || rawTables.length === 0) continue

    // Map old TABLE_NUM to new sequential 1..N TABLE_NUM
    const oldToNewNum = new Map()
    rawTables.forEach((t, idx) => {
      oldToNewNum.set(t.TABLE_NUM, idx + 1)
    })

    console.log(`  Old table nums: ${rawTables.map(t => t.TABLE_NUM).join(', ')}`)
    console.log(`  New consecutive nums: ${rawTables.map((_, idx) => idx + 1).join(', ')}`)

    // Renumber tables and update merge group references
    const renumbered = rawTables.map((t, idx) => {
      const newNum = idx + 1
      let newMergeGroupId = null
      if (t.MERGE_GROUP_ID != null) {
        newMergeGroupId = oldToNewNum.get(t.MERGE_GROUP_ID) ?? t.MERGE_GROUP_ID
      }
      return {
        INFO_ID: `info-${preset.LAYOUT_PRESET_ID}-${newNum}-${Date.now()}-${idx}`,
        LAYOUT_PRESET_ID: preset.LAYOUT_PRESET_ID,
        TABLE_NUM: newNum,
        TABLE_TYPE: t.TABLE_TYPE || 1,
        X_POS: t.X_POS,
        Y_POS: t.Y_POS,
        TABLE_CAPACITY: t.TABLE_CAPACITY ?? (TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity || 4),
        LABEL_ID: t.LABEL_ID != null ? Number(t.LABEL_ID) : null,
        MERGE_GROUP_ID: newMergeGroupId,
      }
    })

    // Sanitize merge groups based on spatial adjacency
    const sanitized = sanitizeLayoutMergeGroups(renumbered)

    // Delete old layout info
    await supabase
      .schema('tables')
      .from('Table_Layout_Info')
      .delete()
      .eq('LAYOUT_PRESET_ID', preset.LAYOUT_PRESET_ID)

    // Insert sanitized, consecutive layout info
    const { error: insErr } = await supabase
      .schema('tables')
      .from('Table_Layout_Info')
      .insert(sanitized)

    if (insErr) {
      console.error(`  Error inserting sanitized layout info for preset ${preset.LAYOUT_PRESET_ID}:`, insErr)
    } else {
      console.log(`  Saved ${sanitized.length} clean layout rows for preset #${preset.LAYOUT_PRESET_ID}.`)
    }
  }

  // 3. Clean Restaurant_Tables:
  // Fetch the default preset's fresh, sanitized Table_Layout_Info
  console.log(`\nSynchronizing Restaurant_Tables with Default Preset #${defaultPreset.LAYOUT_PRESET_ID} "${defaultPreset.PRESET_NAME}"...`)
  const { data: defaultLayout } = await supabase
    .schema('tables')
    .from('Table_Layout_Info')
    .select('*')
    .eq('LAYOUT_PRESET_ID', defaultPreset.LAYOUT_PRESET_ID)
    .order('TABLE_NUM', { ascending: true })

  const validTableNums = new Set((defaultLayout || []).map((t) => t.TABLE_NUM))

  // Fetch all existing Restaurant_Tables
  const { data: currentRest } = await supabase
    .schema('tables')
    .from('Restaurant_Tables')
    .select('*')
    .order('TABLE_ID', { ascending: true })

  // Group by TABLE_NUM to find duplicates
  const byTableNum = new Map()
  for (const row of currentRest || []) {
    const list = byTableNum.get(row.TABLE_NUM) || []
    list.push(row)
    byTableNum.set(row.TABLE_NUM, list)
  }

  // A. Delete duplicate rows and orphan rows
  for (const [tableNum, rows] of byTableNum.entries()) {
    if (!validTableNums.has(tableNum)) {
      // Orphan table not in default layout -> delete all rows
      console.log(`  Deleting orphan table #${tableNum} (${rows.length} rows)...`)
      for (const r of rows) {
        await supabase.schema('tables').from('Restaurant_Tables').delete().eq('TABLE_ID', r.TABLE_ID)
      }
    } else if (rows.length > 1) {
      // Duplicate table -> keep the first one, delete the rest
      console.log(`  Deduplicating table #${tableNum}: keeping TABLE_ID ${rows[0].TABLE_ID}, deleting ${rows.slice(1).map(r => r.TABLE_ID).join(', ')}...`)
      for (const r of rows.slice(1)) {
        await supabase.schema('tables').from('Restaurant_Tables').delete().eq('TABLE_ID', r.TABLE_ID)
      }
    }
  }

  // B. Ensure all tables 1..N exist in Restaurant_Tables
  const { data: cleanRest } = await supabase
    .schema('tables')
    .from('Restaurant_Tables')
    .select('*')

  const existingMap = new Map((cleanRest || []).map((r) => [r.TABLE_NUM, r]))

  for (const lt of defaultLayout || []) {
    const existing = existingMap.get(lt.TABLE_NUM)
    const cap = lt.TABLE_CAPACITY ?? (TABLE_TYPES[lt.TABLE_TYPE]?.defaultCapacity || 4)
    if (existing) {
      await supabase
        .schema('tables')
        .from('Restaurant_Tables')
        .update({
          GUEST_CAPACITY: cap,
          LABEL_ID: lt.LABEL_ID ?? null,
        })
        .eq('TABLE_ID', existing.TABLE_ID)
    } else {
      console.log(`  Inserting missing table #${lt.TABLE_NUM}...`)
      await supabase
        .schema('tables')
        .from('Restaurant_Tables')
        .insert({
          TABLE_NUM: lt.TABLE_NUM,
          STATUS: 'AVAILABLE',
          GUEST_CAPACITY: cap,
          CURRENT_GUEST_COUNT: 0,
          BILL_OUT_REQUESTED: false,
          MERGE_GROUP_ID: null,
          LABEL_ID: lt.LABEL_ID ?? null,
        })
    }
  }

  // C. Link MERGE_GROUP_ID in Restaurant_Tables to captain TABLE_IDs
  const { data: finalRest } = await supabase
    .schema('tables')
    .from('Restaurant_Tables')
    .select('*')

  const finalMap = new Map((finalRest || []).map((r) => [r.TABLE_NUM, r]))

  for (const lt of defaultLayout || []) {
    const restRow = finalMap.get(lt.TABLE_NUM)
    if (!restRow) continue

    let targetMergeId = null
    if (lt.MERGE_GROUP_ID != null) {
      const anchorRow = finalMap.get(lt.MERGE_GROUP_ID)
      if (anchorRow && anchorRow.TABLE_NUM !== lt.TABLE_NUM) {
        targetMergeId = anchorRow.TABLE_ID
      }
    }

    await supabase
      .schema('tables')
      .from('Restaurant_Tables')
      .update({ MERGE_GROUP_ID: targetMergeId })
      .eq('TABLE_ID', restRow.TABLE_ID)
  }

  console.log('\n=== DATABASE CLEANUP COMPLETE ===')
}

cleanDatabase().catch(console.error)
