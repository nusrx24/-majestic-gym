const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://iwhnmedzxcazklyqeacc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3aG5tZWR6eGNhemtseXFlYWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjMwNDYsImV4cCI6MjA5MDY5OTA0Nn0.2okIzAZxqak_JjRoLfv-TFQJKuFA9BtBOgy_Uq8FG8o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log("--- DEFINITIVE TABLE DEBUG ---");
  
  // Method 1: Check Columns by name
  const { data, error } = await supabase
    .from('member_subscriptions')
    .select('amount_paid')
    .limit(1);

  if (error) {
    console.error("❌ ERROR FOUND:", error.message);
  } else {
    console.log("✅ SUCCESS: 'amount_paid' exists in the database.");
  }

  // Method 2: See All columns
  const { data: allData, error: err2 } = await supabase
    .from('member_subscriptions')
    .select('*')
    .limit(1);
    
  if (allData && allData.length > 0) {
    console.log("All Columns in record:", Object.keys(allData[0]));
  } else {
    console.log("Table is empty.");
  }
}

debug();
