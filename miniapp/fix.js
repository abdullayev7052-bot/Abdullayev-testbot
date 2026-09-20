const fs=require("fs");let s=fs.readFileSync("src/App.tsx","utf8");
s=s.replace(/basename=\{import\.meta\.env\.BASE_URL\.replace\([^\n]*\)\}/, 'basename={import.meta.env.BASE_URL.replace(/\/+$/, "")}');
fs.writeFileSync("src/App.tsx",s);
