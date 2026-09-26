export type SceneStatus = 'pending' | 'generating' | 'waiting_quota' | 'done' | 'failed';
export type JobStatus = 'draft' | 'queued' | 'processing' | 'paused' | 'completed' | 'failed';
export type VideoGenerationMode = 'prompt' | 'image_upload' | 'inbuilt_image';

export interface SceneGenerationProgress {
  stage: 'token_check' | 'image_submitted' | 'wan_diffusing' | 'encoding_mp4' | 'complete' | 'error';
  stage_text: string;
  percent: number;
  token_used?: string;
  model_name?: string;
  image_submitted_url?: string;
  logs?: string[];
}

export interface Scene {
  id: string;
  job_id: string;
  scene_index: number;
  narration_text: string;
  visual_prompt: string;
  target_duration_seconds: number;
  status: SceneStatus;
  attempt_count: number;
  last_error: string | null;
  output_path: string | null;
  audio_path: string | null;
  resolution: string;
  image_url?: string | null;
  generation_progress?: SceneGenerationProgress;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  title: string;
  script: string;
  status: JobStatus;
  target_resolution: string;
  aspect_ratio: '16:9' | '9:16' | '1:1';
  created_at: string;
  updated_at: string;
  final_video_path: string | null;
  assembly_status: 'idle' | 'assembling' | 'completed' | 'failed';
  error: string | null;
  generation_mode?: VideoGenerationMode;
  character_anchor_image?: string | null;
  character_anchor_prompt?: string | null;
  scenes?: Scene[];
  simulation?: {
    simulateOOMOnSceneIndex?: number;
    simulateQuotaOnSceneIndex?: number;
    simulateTimeoutOnSceneIndex?: number;
    acceleratedSpeed?: boolean;
  };
  gpuLockActive?: boolean;
  gpuQueueLength?: number;
  currentVramMb?: number;
}

export interface GPULog {
  id: string;
  job_id: string;
  scene_id: string;
  timestamp: string;
  vram_before_mb: number;
  vram_after_mb: number;
  vram_peak_mb: number;
  duration_ms: number;
  outcome: 'SUCCESS' | 'OOM_RETRY' | 'QUOTA_BACKOFF' | 'TIMEOUT_REDUCED' | 'FAILED';
  details: string;
}

export interface SplitSceneResult {
  scene_id: string;
  narration_text: string;
  visual_prompt: string;
  target_duration_seconds: number;
  image_url?: string;
  image_source?: 'upload' | 'inbuilt' | 'character_anchor' | 'none';
}
