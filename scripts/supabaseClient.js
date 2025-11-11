import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FALLBACK_URL = "<SUPABASE_URL>";
const FALLBACK_ANON_KEY = "<SUPABASE_ANON_KEY>";

const SUPABASE_URL = window?.ENV?.SUPABASE_URL ?? FALLBACK_URL;
const SUPABASE_ANON_KEY = window?.ENV?.SUPABASE_ANON_KEY ?? FALLBACK_ANON_KEY;

export const STORAGE_BUCKET = "project-images";
export const PROJECTS_TABLE = "projects";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: "subasit-portfolio-admin",
  },
});
