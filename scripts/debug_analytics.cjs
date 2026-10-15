const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://jskcxvgazgzrafquutms.supabase.co', 'sb_publishable_tyEHM7EMMMlCIKbt83GICA_Hi1TUwQL');

async function test() {
  const now = new Date('2026-10-16T02:43:00+08:00');
  const start = new Date(now.getFullYear() - 2, 0, 1, 0, 0, 0, 0); // 2024-01-01
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Check Order_History error:
  const { data: rawCompletedOrders, error: completedOrdersErr } = await supabase
    .schema('system_history')
    .from('Order_History')
    .select('*')
    .gte('TIME', start.toISOString())
    .lte('TIME', end.toISOString())
    .order('TIME', { ascending: true });

  console.log('Order_History:', rawCompletedOrders?.length, completedOrdersErr?.message);

  // Check Restaurant_Orders:
  const { data: currentOrders, error: ordersError } = await supabase
    .from('Restaurant_Orders')
    .select('*')
    .gte('TIME', start.toISOString())
    .lte('TIME', end.toISOString())
    .order('TIME', { ascending: true });

  console.log('Restaurant_Orders:', currentOrders?.length, ordersError?.message);

  const completedOrdersList = [...(rawCompletedOrders ?? [])];
  const legacyCompletedOrderIds = [];
  const archivedOriginalIds = new Set(
    (rawCompletedOrders ?? [])
      .map((o) => Number(o['ORIGINAL_ORDER_ID']))
      .filter((id) => !isNaN(id) && id > 0)
  );

  for (const ro of currentOrders ?? []) {
    if (ro['ORDER_STATUS'] === 'COMPLETED') {
      const roId = Number(ro['ORDER_ID']);
      if (!archivedOriginalIds.has(roId)) {
        completedOrdersList.push(ro);
        legacyCompletedOrderIds.push(roId);
      }
    }
  }

  console.log('completedOrdersList:', completedOrdersList.length, 'legacyCompletedOrderIds:', legacyCompletedOrderIds.length);

  // Check legacyItems query with all legacyCompletedOrderIds:
  console.log('Querying Order_Items with legacyCompletedOrderIds.length =', legacyCompletedOrderIds.length);
  const { data: legacyItemsData, error: itemsError } = await supabase
    .from('Order_Items')
    .select(`
      ORDER_ITEM_ID,
      ORDER_ID,
      ITEM_ID,
      ORDER_ITEM_STATUS,
      Menu_Items (
        ITEM_ID,
        ITEM_NAME,
        ITEM_PRICE,
        CATEGORY_ID,
        Menu_Categories (
          CATEGORY_ID,
          CATEGORY_NAME
        )
      )
    `)
    .in('ORDER_ID', legacyCompletedOrderIds);

  console.log('Order_Items result:', legacyItemsData?.length, 'error:', itemsError);
}
test();
