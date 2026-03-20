import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

async function getAdmin() {
  const { data, error } = await supabase.from('admin_users').select('username, password').limit(1)
  if (error) console.error(error)
  else console.log(JSON.stringify(data))
}

getAdmin()
