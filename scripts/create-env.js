const { writeFileSync } = require("fs");
const path = require("path");

const envFilePath = path.join(__dirname, "env.js");

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";

const fileContents = `window.ENV = {
  SUPABASE_URL: "${supabaseUrl}",
  SUPABASE_ANON_KEY: "${supabaseAnonKey}",
};
`;

writeFileSync(envFilePath, fileContents, "utf8");

