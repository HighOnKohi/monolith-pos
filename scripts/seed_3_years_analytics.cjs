/**
 * Seeder Script: Populate Database with 3 Years of Realistic Completed Analytics Data
 *
 * Uses the ACTUAL app Supabase project from .env:
 * https://mjwshsrekvaabcfgeizd.supabase.co/
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mjwshsrekvaabcfgeizd.supabase.co/';
const SUPABASE_ANON_KEY = 'sb_publishable_3rhB-vJBi7QE3Ay6Qmuiyw_hkvdof-R';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TOTAL_ORDERS = 1200;
const THREE_YEARS_DAYS = 1095;

const VALID_TABLE_IDS = [1, 2, 3, 5, 6, 7, 8, 9, 10];

const KITCHEN_NOTES = [
  'Extra crispy please',
  'Less oil',
  'No onions if possible',
  'Well done egg',
  'Pack sauce on the side',
  'Separate chili sauce',
  'Rice well heated',
  'Less ice for beverages',
];

const SERVER_NOTES = [
  'Customer asked for extra napkins',
  'Regular dining customer',
  'Table requested water immediately',
  'Split bill requested earlier',
  'Served with priority',
  'VIP guest',
];

const PAYMENT_METHODS = ['CASH', 'CREDIT_CARD', 'INSTAPAY_QR'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('--- STARTING 3-YEAR ANALYTICS SEEDER (TARGETING REAL APP DB) ---');
  console.log(`Connected to: ${SUPABASE_URL}`);

  // Fetch real menu items
  const { data: items, error: itemErr } = await supabase
    .from('Menu_Items')
    .select('ITEM_ID, ITEM_NAME, ITEM_PRICE, CATEGORY_ID');
  if (itemErr || !items || items.length === 0) {
    throw new Error('Failed to fetch items: ' + JSON.stringify(itemErr));
  }

  console.log(`Found ${items.length} active menu items in database.`);

  // 1. Seed Multi-Year Events across 2023, 2024, 2025, 2026
  console.log('\nSeeding multi-year restaurant events...');
  const multiYearEvents = [
    {
      TITLE: 'Annual Christmas Eve Gala 2023',
      CATEGORY: 'Holiday',
      COLOR: '#10B981',
      START_AT: '2023-12-24T18:00:00+08:00',
      END_AT: '2023-12-24T23:59:00+08:00',
      LOCATION: 'Grand Ballroom',
      ORGANIZER: 'Executive Staff',
      EXPECTED_ATTENDEES: 120,
      NOTES: '[REVENUE:85000]',
      IS_CANCELLED: false,
    },
    {
      TITLE: "Valentine's Degustation 2024",
      CATEGORY: 'Promotion',
      COLOR: '#EC4899',
      START_AT: '2024-02-14T17:00:00+08:00',
      END_AT: '2024-02-14T23:00:00+08:00',
      LOCATION: 'Dining Terrace',
      ORGANIZER: 'Chef de Cuisine',
      EXPECTED_ATTENDEES: 75,
      NOTES: '[REVENUE:54000]',
      IS_CANCELLED: false,
    },
    {
      TITLE: 'Summer Beer & Grill Fest 2024',
      CATEGORY: 'Promotion',
      COLOR: '#F59E0B',
      START_AT: '2024-05-18T16:00:00+08:00',
      END_AT: '2024-05-18T23:00:00+08:00',
      LOCATION: 'Courtyard Garden',
      ORGANIZER: 'Brew Masters',
      EXPECTED_ATTENDEES: 140,
      NOTES: '[REVENUE:92000]',
      IS_CANCELLED: false,
    },
    {
      TITLE: 'Halloween Banquet 2024',
      CATEGORY: 'Holiday',
      COLOR: '#8B5CF6',
      START_AT: '2024-10-31T19:00:00+08:00',
      END_AT: '2024-10-31T23:59:00+08:00',
      LOCATION: 'Main Dining Hall',
      ORGANIZER: 'Events Coordinator',
      EXPECTED_ATTENDEES: 90,
      NOTES: '[REVENUE:68000]',
      IS_CANCELLED: false,
    },
    {
      TITLE: 'New Year Grand Countdown 2025',
      CATEGORY: 'Holiday',
      COLOR: '#E9C46A',
      START_AT: '2024-12-31T20:00:00+08:00',
      END_AT: '2025-01-01T02:00:00+08:00',
      LOCATION: 'Grand Ballroom',
      ORGANIZER: 'Management',
      EXPECTED_ATTENDEES: 160,
      NOTES: '[REVENUE:125000]',
      IS_CANCELLED: false,
    },
    {
      TITLE: 'Wine Pairing Promotion 2025',
      CATEGORY: 'Promotion',
      COLOR: '#6366F1',
      START_AT: '2025-04-12T17:00:00+08:00',
      END_AT: '2025-04-12T21:00:00+08:00',
      LOCATION: 'Private Reserve Room',
      ORGANIZER: 'Head Sommelier',
      EXPECTED_ATTENDEES: 40,
      NOTES: '[REVENUE:42000]',
      IS_CANCELLED: false,
    },
    {
      TITLE: 'Mid-Autumn Catering Banquet 2025',
      CATEGORY: 'Catering',
      COLOR: '#EF4444',
      START_AT: '2025-09-20T18:00:00+08:00',
      END_AT: '2025-09-20T22:30:00+08:00',
      LOCATION: 'Main Dining Hall',
      ORGANIZER: 'Event Staff',
      EXPECTED_ATTENDEES: 110,
      NOTES: '[REVENUE:78000]',
      IS_CANCELLED: false,
    },
    {
      TITLE: 'Founders Anniversary 2026',
      CATEGORY: 'Other',
      COLOR: '#14274E',
      START_AT: '2026-03-22T18:00:00+08:00',
      END_AT: '2026-03-22T23:00:00+08:00',
      LOCATION: 'Grand Ballroom',
      ORGANIZER: 'Monolith Board',
      EXPECTED_ATTENDEES: 150,
      NOTES: '[REVENUE:110000]',
      IS_CANCELLED: false,
    },
  ];

  for (const ev of multiYearEvents) {
    const { data: existing } = await supabase
      .from('Restaurant_Events')
      .select('EVENT_ID')
      .eq('TITLE', ev.TITLE)
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await supabase.from('Restaurant_Events').insert(ev);
      if (insErr) {
        console.warn(`Could not seed event "${ev.TITLE}":`, insErr.message);
      } else {
        console.log(`+ Seeded Event: ${ev.TITLE}`);
      }
    }
  }

  // 2. Generate Orders spanning 3 Years (Oct 16, 2023 to Oct 16, 2026)
  console.log(`\nGenerating ${TOTAL_ORDERS} completed orders across 3 years (~1,095 days)...`);

  const now = new Date('2026-10-16T02:30:00+08:00').getTime();
  const threeYearsAgo = now - THREE_YEARS_DAYS * 86400000;

  let totalOrdersInserted = 0;
  let totalOrderItemsInserted = 0;

  const BATCH_SIZE = 50;
  const numBatches = Math.ceil(TOTAL_ORDERS / BATCH_SIZE);

  for (let b = 0; b < numBatches; b++) {
    const batchOrdersToInsert = [];
    const batchItemsSpec = [];

    const currentBatchCount = Math.min(BATCH_SIZE, TOTAL_ORDERS - b * BATCH_SIZE);

    for (let i = 0; i < currentBatchCount; i++) {
      const orderGlobalIndex = b * BATCH_SIZE + i;
      const progressRatio = orderGlobalIndex / TOTAL_ORDERS;
      // Slight upward growth trend in recent years
      const weightedRatio = Math.pow(progressRatio, 0.85);
      const timestampMs = threeYearsAgo + weightedRatio * (now - threeYearsAgo);

      // Random jitter +/- 12 hours
      const jitterMs = (Math.random() - 0.5) * 86400000;
      const orderDate = new Date(Math.min(timestampMs + jitterMs, now - 3600000));

      // Operating Hours: 10:00 to 22:00, with lunch and dinner peaks
      let hour;
      const hrRand = Math.random();
      if (hrRand < 0.45) {
        hour = 17 + Math.floor(Math.random() * 4); // Dinner rush: 17, 18, 19, 20
      } else if (hrRand < 0.80) {
        hour = 11 + Math.floor(Math.random() * 3); // Lunch rush: 11, 12, 13
      } else {
        hour = 14 + Math.floor(Math.random() * 3); // Afternoon: 14, 15, 16
      }
      orderDate.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);

      const isDineIn = Math.random() < 0.72;
      const orderType = isDineIn ? 'DINE-IN' : 'TAKEOUT';
      const tableId = getRandomElement(VALID_TABLE_IDS);

      let guestCount;
      if (isDineIn) {
        const rand = Math.random();
        guestCount = rand < 0.40 ? (1 + Math.floor(Math.random() * 2)) :
                     rand < 0.80 ? (3 + Math.floor(Math.random() * 2)) :
                                   (5 + Math.floor(Math.random() * 3));
      } else {
        guestCount = 1 + Math.floor(Math.random() * 2);
      }

      // Order Source Channel: ~60% Service Staff ('Cashier'), ~40% Customer Interface ('Customer')
      const requestedFrom = Math.random() < 0.60 ? 'Cashier' : 'Customer';

      // Payment Method
      const payRand = Math.random();
      const paymentMethod = payRand < 0.45 ? 'CASH' : payRand < 0.80 ? 'CREDIT_CARD' : 'INSTAPAY_QR';

      // Durations
      const prepMinutes = 8 + Math.floor(Math.random() * 15);
      const deliveryMinutes = 2 + Math.floor(Math.random() * 5);
      const turnaroundMinutes = isDineIn ? (25 + Math.floor(Math.random() * 35)) : (2 + Math.floor(Math.random() * 5));

      const readyDate = new Date(orderDate.getTime() + prepMinutes * 60000);
      const servedDate = new Date(readyDate.getTime() + deliveryMinutes * 60000);
      const completedDate = new Date(servedDate.getTime() + turnaroundMinutes * 60000);

      // Select 1 to 4 distinct menu items
      const numItemsToPick = 1 + Math.floor(Math.random() * Math.min(4, items.length));
      const shuffled = [...items].sort(() => 0.5 - Math.random());
      const selectedItems = shuffled.slice(0, numItemsToPick);

      let subtotal = 0;
      const orderItems = [];

      for (const it of selectedItems) {
        const qty = 1 + Math.floor(Math.random() * 2);
        subtotal += Number(it.ITEM_PRICE) * qty;
        for (let q = 0; q < qty; q++) {
          orderItems.push({
            ITEM_ID: it.ITEM_ID,
            ORDER_ITEM_STATUS: 'DONE',
          });
        }
      }

      // Occasional 15% discount for Senior / PWD
      const isDiscounted = Math.random() < 0.15;
      const total = isDiscounted ? Math.round(subtotal * 0.85 * 100) / 100 : subtotal;

      batchOrdersToInsert.push({
        TABLE_ID: tableId,
        REQUESTED_FROM: requestedFrom,
        ORDER_TYPE: orderType,
        ORDER_STATUS: 'COMPLETED',
        SUBTOTAL_BILL: subtotal,
        TOTAL_BILL: total,
        TIME: orderDate.toISOString().replace('Z', ''),
        READY_AT: readyDate.toISOString().replace('Z', ''),
        SERVED_AT: servedDate.toISOString().replace('Z', ''),
        COMPLETED_AT: completedDate.toISOString().replace('Z', ''),
        GUEST_COUNT: guestCount,
        PAYMENT_METHOD: paymentMethod,
        KITCHEN_NOTE: Math.random() < 0.15 ? getRandomElement(KITCHEN_NOTES) : null,
        SERVER_NOTE: Math.random() < 0.10 ? getRandomElement(SERVER_NOTES) : null,
      });

      batchItemsSpec.push(orderItems);
    }

    // Insert batch into Restaurant_Orders
    const { data: insertedOrders, error: batchErr } = await supabase
      .from('Restaurant_Orders')
      .insert(batchOrdersToInsert)
      .select('ORDER_ID');

    if (batchErr || !insertedOrders) {
      console.error(`Batch ${b + 1} insert error:`, batchErr);
      continue;
    }

    totalOrdersInserted += insertedOrders.length;

    // Build child items with real generated ORDER_IDs
    const allChildRows = [];
    insertedOrders.forEach((o, idx) => {
      const itemsForOrder = batchItemsSpec[idx] || [];
      itemsForOrder.forEach((it) => {
        allChildRows.push({
          ORDER_ID: o.ORDER_ID,
          ...it,
        });
      });
    });

    if (allChildRows.length > 0) {
      const { error: itemsErr } = await supabase.from('Order_Items').insert(allChildRows);
      if (itemsErr) {
        console.error(`Batch ${b + 1} items insert error:`, itemsErr);
      } else {
        totalOrderItemsInserted += allChildRows.length;
      }
    }

    process.stdout.write(`Progress: ${totalOrdersInserted}/${TOTAL_ORDERS} orders inserted...\r`);
  }

  console.log(`\n\n=== 3-YEAR SEEDING COMPLETE ===`);
  console.log(`- Successfully inserted ${totalOrdersInserted} completed orders across 3 years`);
  console.log(`- Successfully inserted ${totalOrderItemsInserted} order items`);
  console.log(`- Real App Database is now fully populated across all months, weeks, and days!`);
}

main().catch((err) => {
  console.error('Fatal error in seeder:', err);
  process.exit(1);
});
