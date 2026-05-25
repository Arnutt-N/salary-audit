import { run } from "node:test"
import { spec } from "node:test/reporters"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const files = [
  path.join(__dirname, "freshness.test.ts"),
  path.join(__dirname, "api", "employees.test.ts"),
  path.join(__dirname, "api", "batches.test.ts"),
  path.join(__dirname, "api", "dashboard.test.ts"),
]

const stream = run({ files, concurrency: false })

stream.on("test:fail", () => {
  process.exitCode = 1
})

stream.compose(new spec()).pipe(process.stdout)
