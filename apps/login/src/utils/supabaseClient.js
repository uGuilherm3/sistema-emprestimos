import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dtdybgimiecwsudofbpl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHliZ2ltaWVjd3N1ZG9mYnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjg3OTEsImV4cCI6MjA5MTc0NDc5MX0.F1Ijvvgzqu4VgdbqvKhWtoQndg0QsSLbipEabUHzYEc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
