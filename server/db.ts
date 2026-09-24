import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { JobRecord, SceneRecord, GPULogRecord, JobStatus, SceneStatus } from './types.ts';

const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const DB_DIR = path.join(STORAGE_DIR, 'db');
const CLIPS_DIR = path.join(STORAGE_DIR, 'clips');
const AUDIO_DIR = path.join(STORAGE_DIR, 'audio');
const OUTPUTS_DIR = path.join(STORAGE_DIR, 'outputs');
const LOGS_DIR = path.join(STORAGE_DIR, 'logs');

// Ensure directories exist
for (const dir of [STORAGE_DIR, DB_DIR, CLIPS_DIR, AUDIO_DIR, OUTPUTS_DIR, LOGS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const DB_PATH = path.join(DB_DIR, 'pipeline.db');
const db = new DatabaseSync(DB_PATH);

// Initialize schema with WAL mode and pragmas
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    script TEXT NOT NULL,
    status TEXT NOT NULL,
    target_resolution TEXT NOT NULL DEFAULT '720p',
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    final_video_path TEXT,
    assembly_status TEXT NOT NULL DEFAULT 'idle',
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    scene_index INTEGER NOT NULL,
    narration_text TEXT NOT NULL,
    visual_prompt TEXT NOT NULL,
    target_duration_seconds REAL NOT NULL DEFAULT 5.0,
    status TEXT NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    output_path TEXT,
    audio_path TEXT,
    resolution TEXT NOT NULL DEFAULT '720p',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS gpu_logs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    vram_before_mb REAL NOT NULL,
    vram_after_mb REAL NOT NULL,
    vram_peak_mb REAL NOT NULL,
    duration_ms INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    details TEXT NOT NULL
  );
`);

// Safe column migrations for existing databases
try { db.exec('ALTER TABLE jobs ADD COLUMN generation_mode TEXT;'); } catch {}
try { db.exec('ALTER TABLE jobs ADD COLUMN character_anchor_image TEXT;'); } catch {}
try { db.exec('ALTER TABLE jobs ADD COLUMN character_anchor_prompt TEXT;'); } catch {}
try { db.exec('ALTER TABLE scenes ADD COLUMN image_url TEXT;'); } catch {}

export const dbService = {
  getPaths() {
    return {
      storageDir: STORAGE_DIR,
      dbDir: DB_DIR,
      clipsDir: CLIPS_DIR,
      audioDir: AUDIO_DIR,
      outputsDir: OUTPUTS_DIR,
      logsDir: LOGS_DIR,
    };
  },

  createJob(job: Omit<JobRecord, 'created_at' | 'updated_at' | 'assembly_status' | 'final_video_path' | 'error'>): JobRecord {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO jobs (id, title, script, status, target_resolution, aspect_ratio, created_at, updated_at, assembly_status, generation_mode, character_anchor_image, character_anchor_prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?)
    `);
    stmt.run(
      job.id,
      job.title,
      job.script,
      job.status,
      job.target_resolution,
      job.aspect_ratio,
      now,
      now,
      job.generation_mode || 'prompt',
      job.character_anchor_image || null,
      job.character_anchor_prompt || null
    );

    return this.getJob(job.id)!;
  },

  getJob(id: string): JobRecord | null {
    const jobStmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
    const job = jobStmt.get(id) as unknown as JobRecord | undefined;
    if (!job) return null;

    const scenesStmt = db.prepare('SELECT * FROM scenes WHERE job_id = ? ORDER BY scene_index ASC');
    const scenes = scenesStmt.all(id) as unknown as SceneRecord[];
    return {
      ...job,
      scenes,
    };
  },

  getAllJobs(): JobRecord[] {
    const stmt = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50');
    const jobs = stmt.all() as unknown as JobRecord[];
    return jobs.map(j => {
      const scenesStmt = db.prepare('SELECT * FROM scenes WHERE job_id = ? ORDER BY scene_index ASC');
      return {
        ...j,
        scenes: scenesStmt.all(j.id) as unknown as SceneRecord[],
      };
    });
  },

  updateJobStatus(id: string, status: JobStatus, error: string | null = null, finalVideoPath: string | null = null, assemblyStatus?: string) {
    const now = new Date().toISOString();
    let query = 'UPDATE jobs SET status = ?, updated_at = ?';
    const params: (string | null)[] = [status, now];

    if (error !== undefined) {
      query += ', error = ?';
      params.push(error);
    }
    if (finalVideoPath !== null) {
      query += ', final_video_path = ?';
      params.push(finalVideoPath);
    }
    if (assemblyStatus) {
      query += ', assembly_status = ?';
      params.push(assemblyStatus);
    }
    query += ' WHERE id = ?';
    params.push(id);

    db.prepare(query).run(...params);
  },

  addScene(scene: Omit<SceneRecord, 'created_at' | 'updated_at' | 'attempt_count' | 'last_error' | 'output_path' | 'audio_path'>): SceneRecord {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO scenes (id, job_id, scene_index, narration_text, visual_prompt, target_duration_seconds, status, attempt_count, resolution, image_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `);
    stmt.run(
      scene.id,
      scene.job_id,
      scene.scene_index,
      scene.narration_text,
      scene.visual_prompt,
      scene.target_duration_seconds,
      scene.status,
      scene.resolution,
      scene.image_url || null,
      now,
      now
    );

    return this.getScene(scene.id)!;
  },

  getScene(id: string): SceneRecord | null {
    const stmt = db.prepare('SELECT * FROM scenes WHERE id = ?');
    const scene = stmt.get(id) as unknown as SceneRecord | undefined;
    return scene || null;
  },

  updateScene(
    id: string,
    updates: Partial<{
      status: SceneStatus;
      attempt_count: number;
      last_error: string | null;
      output_path: string | null;
      audio_path: string | null;
      resolution: string;
      target_duration_seconds: number;
      visual_prompt: string;
      narration_text: string;
    }>
  ) {
    const now = new Date().toISOString();
    const keys = Object.keys(updates) as (keyof typeof updates)[];
    if (keys.length === 0) return;

    const setClauses = keys.map(k => `${k} = ?`).join(', ') + ', updated_at = ?';
    const values = keys.map(k => updates[k] as any);
    values.push(now, id);

    const query = `UPDATE scenes SET ${setClauses} WHERE id = ?`;
    db.prepare(query).run(...values);
  },

  resetSceneForRetry(id: string) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE scenes
      SET status = 'pending',
          last_error = NULL,
          updated_at = ?
      WHERE id = ?
    `).run(now, id);
  },

  logGPU(entry: Omit<GPULogRecord, 'id' | 'timestamp'>) {
    const id = 'log_' + Math.random().toString(36).substring(2, 10);
    const timestamp = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO gpu_logs (id, job_id, scene_id, timestamp, vram_before_mb, vram_after_mb, vram_peak_mb, duration_ms, outcome, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      entry.job_id,
      entry.scene_id,
      timestamp,
      entry.vram_before_mb,
      entry.vram_after_mb,
      entry.vram_peak_mb,
      entry.duration_ms,
      entry.outcome,
      entry.details
    );

    // Also append to structured text log file for zero-dependency inspection
    const logFilePath = path.join(LOGS_DIR, `gpu_calls_${entry.job_id}.jsonl`);
    const line = JSON.stringify({ id, timestamp, ...entry }) + '\n';
    fs.appendFileSync(logFilePath, line, 'utf-8');
  },

  getJobLogs(jobId: string): GPULogRecord[] {
    const stmt = db.prepare('SELECT * FROM gpu_logs WHERE job_id = ? ORDER BY timestamp DESC LIMIT 100');
    return stmt.all(jobId) as unknown as GPULogRecord[];
  },

  deleteJob(id: string) {
    db.prepare('DELETE FROM gpu_logs WHERE job_id = ?').run(id);
    db.prepare('DELETE FROM scenes WHERE job_id = ?').run(id);
    db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  }
};
