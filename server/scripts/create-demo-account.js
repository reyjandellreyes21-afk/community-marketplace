import "../load-env.js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoEmail = process.env.DEMO_EMAIL || "andy@gmail.com";
const demoPassword = process.env.DEMO_PASSWORD || "Password@gmail.com";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env.");
}
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listed, error: listError } = await supabase.auth.admin.listUsers();
if (listError) throw listError;

let demoUser = listed.users.find((u) => String(u.email || "").toLowerCase() === demoEmail.toLowerCase());

if (!demoUser) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: demoEmail,
    password: demoPassword,
    email_confirm: true,
  });
  if (error) throw error;
  demoUser = data.user;
} else {
  const { data, error } = await supabase.auth.admin.updateUserById(demoUser.id, {
    email: demoEmail,
    password: demoPassword,
    email_confirm: true,
  });
  if (error) throw error;
  demoUser = data.user;
}

const { error: profileError } = await supabase.from("profiles").upsert({
  id: demoUser.id,
  email: demoUser.email,
  first_name: "Demo",
  last_name: "Andy",
  username: "andy_demo",
  accepted_terms: true,
  accepted_terms_at: new Date().toISOString(),
});
if (profileError && profileError.code !== "PGRST205") throw profileError;
if (profileError?.code === "PGRST205") {
  // eslint-disable-next-line no-console
  console.warn("profiles table not found yet; auth demo user was still created.");
}

// eslint-disable-next-line no-console
console.log(`Demo account is ready: ${demoEmail}`);
