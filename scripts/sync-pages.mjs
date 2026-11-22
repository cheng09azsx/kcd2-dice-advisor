import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "dist", "index.html");
if (!fs.existsSync(source)) {
  console.error("dist/index.html 不存在，先运行 pnpm build");
  process.exit(1);
}

const docs = path.join(root, "docs");
fs.mkdirSync(docs, { recursive: true });
fs.copyFileSync(source, path.join(docs, "index.html"));
fs.writeFileSync(path.join(docs, ".nojekyll"), "");
fs.copyFileSync(source, path.join(root, "KCD2骰子参谋.html"));

console.log("已同步 docs/index.html 与 KCD2骰子参谋.html");
