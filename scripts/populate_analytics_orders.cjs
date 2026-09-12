/**
 * Seeder Script: Populate Database with Realistic Completed Orders for Analytics
 *
 * Runs via Node.js using @supabase/supabase-js.
 * Dynamically queries available tables and menu items, then generates 250 completed
 * DINE-IN and TAKEOUT orders across the last 75 days.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jskcxvgazgzrafquutms.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tyEHM7EMMMlCIKbt83GICA_Hi1TUwQL';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TOTAL_ORDERS = 250;
const DAYS_BACK = 75;

const KITCHEN_NOTES = [
  'Extra crispy please',
  'Less oil',
  'No onions if possible',
  'Well done egg',
  'Pack sauce on the side',
  'Separate chili sauce',
  'Rice well heated',
  'Less ice for beverages'
];

const SERVER_NOTES = [
  'Customer asked for extra napkins',
  'Regular dining customer',
  'Table requested water immediately',
  'Split bill requested earlier',
  'Served with priority'
];

const PAYMENT_METHODS = ['CASH', 'CREDIT_CARD', 'INSTAPAY_QR'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('Fetching available tables and menu items from database...');
  
  const { data: tables, error: tableErr } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_ID, TABLE_NUM, GUEST_CAPACITY');
  if (tableErr || !tables || tables.length === 0) {
    throw new Error('Failed to fetch tables: ' + JSON.stringify(tableErr));
  }

  const { data: items, error: itemErr } = await supabase
    .from('Menu_Items')
    .select('ITEM_ID, ITEM_NAME, ITEM_PRICE, CATEGORY_ID');
  if (itemErr || !items || items.length === 0) {
    throw new Error('Failed to fetch items: ' + JSON.stringify(itemErr));
  }

  console.log(`Found ${tables.length} tables and ${items.length} menu items.`);
  console.log(`Generating ${TOTAL_ORDERS} completed orders across the last ${DAYS_BACK} days...`);

  const now = Date.now();
  let successCount = 0;
  let totalOrderItemsCount = 0;

  // Process in batches of 25 to avoid network congestion
  const BATCH_SIZE = 25;
  for (let batchStart = 0; batchStart < TOTAL_ORDERS; batchStart += BATCH_SIZE) {
    const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_ORDERS - batchStart);
    const orderPromises = [];

    for (let i = 0; i < currentBatchSize; i++) {
      const isDineIn = Math.random() < 0.70;
      const orderType = isDineIn ? 'DINE-IN' : 'TAKEOUT';
      const table = getRandomElement(tables);
      const tableId = table.TABLE_ID;

      // Party size
      let guestCount;
      if (isDineIn) {
        const rand = Math.random();
        guestCount = rand < 0.45 ? (1 + Math.floor(Math.random() * 2)) :
                     rand < 0.80 ? (3 + Math.floor(Math.random() * 2)) :
                                   (5 + Math.floor(Math.random() * 2));
      } else {
        guestCount = 1 + Math.floor(Math.random() * 2);
      }

      // Channel
      const requestedFrom = Math.random() < 0.60 ? 'Cashier' : 'Customer';

      // Payment Method
      const payRand = Math.random();
      const paymentMethod = payRand < 0.50 ? 'CASH' : payRand < 0.80 ? 'CREDIT_CARD' : 'INSTAPAY_QR';

      // Random date across the last DAYS_BACK days
      const daysAgo = Math.random() * DAYS_BACK;
      const dateObj = new Date(now - daysAgo * 86400000);

      // Hour distribution: operating hours 10:00 - 22:00
      let hour;
      const hrRand = Math.random();
      if (hrRand < 0.45) {
        hour = 17 + Math.floor(Math.random() * 4); // 17, 18, 19, 20
      } else if (hrRand < 0.80) {
        hour = 11 + Math.floor(Math.random() * 3); // 11, 12, 13
      } else {
        hour = Math.random() < 0.60 ? (14 + Math.floor(Math.random() * 3)) : 10;
      }
      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);
      dateObj.setHours(hour, minute, second, 0);

      if (dateObj.getTime() > now - 1800000) {
        dateObj.setTime(now - (3600000 + Math.random() * 14400000));
      }

      // Kitchen prep & serving durations
      const prepMinutes = 8 + Math.floor(Math.random() * 15);
      const deliveryMinutes = 2 + Math.floor(Math.random() * 5);
      const turnaroundMinutes = isDineIn ? (20 + Math.floor(Math.random() * 35)) : (2 + Math.floor(Math.random() * 5));

      const readyDate = new Date(dateObj.getTime() + prepMinutes * 60000);
      const servedDate = new Date(readyDate.getTime() + deliveryMinutes * 60000);
      const completedDate = new Date(servedDate.getTime() + turnaroundMinutes * 60000);

      // Notes
      const kitchenNote = Math.random() < 0.20 ? getRandomElement(KITCHEN_NOTES) : null;
      const serverNote = Math.random() < 0.15 ? getRandomElement(SERVER_NOTES) : null;

      // Select distinct items
      const numItemsToPick = 1 + Math.floor(Math.random() * Math.min(4, items.length));
      const shuffled = [...items].sort(() => 0.5 - Math.random());
      const selectedItems = shuffled.slice(0, numItemsToPick);

      // Quantities & Subtotal
      let subtotal = 0;
      const itemRowsToInsert = [];

      for (const it of selectedItems) {
        const qty = 1 + Math.floor(Math.random() * 2); // 1 to 2 portions
        subtotal += Number(it.ITEM_PRICE) * qty;
        for (let q = 0; q < qty; q++) {
          itemRowsToInsert.push({
            ITEM_ID: it.ITEM_ID,
            ORDER_ITEM_STATUS: 'DONE',
            IS_FLAGGED: false,
          });
        }
      }

      // Discount (15% chance of Senior / PWD 20% discount)
      const isDiscounted = Math.random() < 0.15;
      const total = isDiscounted ? Math.round(subtotal * 0.8 * 100) / 100 : subtotal;

      const orderPayload = {
        TABLE_ID: tableId,
        REQUESTED_FROM: requestedFrom,
        ORDER_TYPE: orderType,
        ORDER_STATUS: 'COMPLETED',
        SUBTOTAL_BILL: subtotal,
        TOTAL_BILL: total,
        TIME: dateObj.toISOString().replace('Z', ''),
        READY_AT: readyDate.toISOString().replace('Z', ''),
        SERVED_AT: servedDate.toISOString().replace('Z', ''),
        COMPLETED_AT: completedDate.toISOString().replace('Z', ''),
        GUEST_COUNT: guestCount,
        PAYMENT_METHOD: paymentMethod,
        KITCHEN_NOTE: kitchenNote,
        SERVER_NOTE: serverNote,
      };

      orderPromises.push({ orderPayload, itemRowsToInsert });
    }

    // Insert orders and child items
    for (const item of orderPromises) {
      const { data: oData, error: oErr } = await supabase
        .from('Restaurant_Orders')
        .insert(item.orderPayload)
        .select('ORDER_ID')
        .single();

      if (oErr || !oData) {
        console.error('Failed to insert order:', oErr);
        continue;
      }

      const orderId = oData.ORDER_ID;
      const childRows = item.itemRowsToInsert.map((cr) => ({
        ORDER_ID: orderId,
        ...cr,
      }));

      const { error: iErr } = await supabase.from('Order_Items').insert(childRows);
      if (iErr) {
        console.error(`Failed to insert items for order ${orderId}:`, iErr);
      } else {
        successCount++;
        totalOrderItemsCount += childRows.length;
      }
    }

    console.log(`Progress: ${successCount}/${TOTAL_ORDERS} orders created...`);
  }

  console.log(`\nSuccessfully populated database!`);
  console.log(`- Completed Orders Created: ${successCount}`);
  console.log(`- Order Items Created: ${totalOrderItemsCount}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
