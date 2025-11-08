// js/supabase.js
const SUPABASE_URL = 'https://yxzztomtgaqmboquoszg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4enp0b210Z2FxbWJvcXVvc3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzU4OTQsImV4cCI6MjA3ODAxMTg5NH0.NKaBpeTUE3zgcyCOl_mbF1NJHGry5I8vBDzkb1RS1DY';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Initialize database tables if they don't exist
async function initializeDatabase() {
    try {
        // Check if tables exist, if not create them
        const { data: tables, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public');

        if (error) {
            console.log('Database not initialized, creating tables...');
            await createTables();
        }
    } catch (error) {
        console.log('Initializing database tables...');
        await createTables();
    }
}

async function createTables() {
    // This would normally be done via SQL, but we'll handle it through the API
    console.log('Please run the SQL schema in your Supabase dashboard');
}

// Initialize when loaded
document.addEventListener('DOMContentLoaded', initializeDatabase);
