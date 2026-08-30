import { readFile } from "node:fs/promises";
import type { PipelineRun } from "../../shared/types.js";
import { dataPath } from "./duckdb.js";

let cached: Promise<PipelineRun[]> | null = null;

export async function loadRuns(): Promise<PipelineRun[]> {
  if (!cached) {
    cached = readFile(dataPath("meta", "pipeline_runs.json"), "utf8")
      .then((text) => JSON.parse(text) as PipelineRun[])
      .catch(() => []);
  }
  return cached;
}

export async function latestRun(): Promise<PipelineRun | undefined> {
  return (await loadRuns())[0];
}
