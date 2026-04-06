import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Anon Key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log("Checking columns for 'member_subscriptions'...");
  
  // Method 1: Try to select the column specifically
  const { data, error } = await supabase
    .from('member_subscriptions')
    .select('amount_paid')
    .limit(1);

  if (error) {
    console.log("\n❌ Error selecting 'amount_paid':", error.message);
    if (error.message.includes('column "amount_paid" does not exist')) {
      console.log("CONFIRMED: The column 'amount_paid' is missing from the database.");
    }
  } else {
    console.log("\n✅ Success! Column 'amount_paid' exists.");
    console.log("PostgREST cache is clearly refreshed and seeing the column.");
  }
}

checkColumns();
