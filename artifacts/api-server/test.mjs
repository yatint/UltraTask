import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { builtinModules, createRequire } from "node:module";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const artifact = fileURLToPath(new URL("./", import.meta.url));
const tests = ["task-insights", "overdue-reminders", "ticket-access"];
await build({
  entryPoints: tests.map((name) => `${artifact}src/lib/${name}.test.ts`),
  bundle: true, platform: "node", format: "cjs",
  plugins: [{
    name: "workspace-test-dependencies",
    setup(builder) {
      builder.onResolve({ filter: /^[^./]/ }, (args) => {
        if (args.path === "@workspace/db") return { path: `${root}lib/db/src/index.ts` };
        if (args.path.startsWith("node:") || builtinModules.includes(args.path)) return { path: args.path, external: true };
        // Preserve each package's pnpm dependency context rather than moving
        // external DB dependencies into the API package's resolution scope.
        const require = createRequire(path.join(args.resolveDir, "test-resolve.cjs"));
        return { path: require.resolve(args.path), external: true };
      });
    },
  }],
  outdir: `${artifact}.local/tests`, outExtension: { ".js": ".cjs" },
});
const result = spawnSync(process.execPath, ["--test", ...tests.map((name) => `${artifact}.local/tests/${name}.test.cjs`)], {
  cwd: artifact, stdio: "inherit",
});
process.exitCode = result.status ?? 1;
