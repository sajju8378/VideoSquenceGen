import express, { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { dbService } from './db.ts';
import { splitScriptWithGemini } from './gemini.ts';
import { processScene, runJobQueue, setJobSimulation, getJobSimulation, globalGPULock, vramTracker } from './gpu_worker.ts';
import { assembleFinalVideo } from './assembler.ts';
import { getZeroGPUPythonAppCode, getZeroGPURequirementsTxt, getZeroGPUReadme } from './spaces_exporter.ts';

export const apiRouter = Router();

// Middleware
apiRouter.use(express.json());

// 1. Split script using Gemini 3.8 Flash
apiRouter.post('/split-script', async (req: Request, res: Response) => {
  try {
    const { script, targetDuration, genreStyle, aspectRatio } = req.body;
    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide a valid text script' });
    }

    const result = await splitScriptWithGemini(script, {
      targetSceneDuration: targetDuration ? Number(targetDuration) : 5.0,
      genreStyle,
      aspectRatio,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to split script' });
  }
});

// 2. Create a new job with scenes
apiRouter.post('/jobs', async (req: Request, res: Response) => {
  try {
    const { title, script, targetResolution, aspectRatio, scenes, simulation } = req.body;
    if (!script || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({ error: 'Job must contain a script and at least one scene' });
    }

    const jobId = 'job_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

    const job = dbService.createJob({
      id: jobId,
      title: title || 'Untitled Project',
      script,
      status: 'draft',
      target_resolution: targetResolution || '720p',
      aspect_ratio: aspectRatio || '16:9',
    });

    scenes.forEach((s: any, idx: number) => {
      const sceneId = `${jobId}_s${idx + 1}`;
      dbService.addScene({
        id: sceneId,
        job_id: jobId,
        scene_index: idx,
        narration_text: s.narration_text || '',
        visual_prompt: s.visual_prompt || '',
        target_duration_seconds: Number(s.target_duration_seconds) || 5.0,
        status: 'pending',
        resolution: targetResolution || '720p',
      });
    });

    if (simulation) {
      setJobSimulation(jobId, simulation);
    }

    const fullJob = dbService.getJob(jobId);
    res.json(fullJob);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create job' });
  }
});

// 3. Get all jobs
apiRouter.get('/jobs', (req: Request, res: Response) => {
  try {
    const jobs = dbService.getAllJobs();
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get specific job
apiRouter.get('/jobs/:id', (req: Request, res: Response) => {
  try {
    const job = dbService.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({
      ...job,
      simulation: getJobSimulation(job.id),
      gpuLockActive: globalGPULock.isLocked(),
      gpuQueueLength: globalGPULock.queueLength(),
      currentVramMb: vramTracker.getMemoryAllocated(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Start / Resume job queue (Sequential GPU processing)
apiRouter.post('/jobs/:id/start', async (req: Request, res: Response) => {
  try {
    const job = dbService.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (req.body.simulation) {
      setJobSimulation(job.id, req.body.simulation);
    }

    // Launch sequential queue in background so caller receives immediate 200 response
    // and can poll state (Requirement #8)
    runJobQueue(job.id).catch(err => {
      console.error(`Error in job queue for ${job.id}:`, err);
    });

    res.json({ message: 'Job processing started', jobId: job.id, status: 'processing' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Retry isolated scene
apiRouter.post('/jobs/:id/retry-scene', async (req: Request, res: Response) => {
  try {
    const { sceneId, forcedResolution } = req.body;
    if (!sceneId) return res.status(400).json({ error: 'sceneId is required' });

    dbService.resetSceneForRetry(sceneId);

    // Process scene in background or foreground
    processScene(sceneId, { forcedResolution }).then(() => {
      // Re-evaluate job status
      const job = dbService.getJob(req.params.id);
      if (job && job.scenes?.every(s => s.status === 'done')) {
        dbService.updateJobStatus(job.id, 'completed');
      }
    });

    res.json({ message: `Scene ${sceneId} queued for retry`, sceneId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Update Scene prompt or narration
apiRouter.patch('/jobs/:id/scenes/:sceneId', (req: Request, res: Response) => {
  try {
    const { visual_prompt, narration_text, target_duration_seconds } = req.body;
    dbService.updateScene(req.params.sceneId, {
      visual_prompt,
      narration_text,
      target_duration_seconds: Number(target_duration_seconds),
      status: 'pending', // Re-mark pending so it can be re-run
    });
    const updated = dbService.getScene(req.params.sceneId);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Independent Assembly Step (Requirement #6)
apiRouter.post('/jobs/:id/assemble', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const { transitionType, backgroundMusicVolume } = req.body;

    const result = await assembleFinalVideo(jobId, {
      transitionType,
      backgroundMusicVolume,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const job = dbService.getJob(jobId);
    res.json({
      message: 'Assembly completed',
      finalVideoPath: result.finalVideoPath,
      downloadUrl: `/api/media/outputs/${result.finalVideoPath}`,
      job,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Get GPU logs
apiRouter.get('/jobs/:id/logs', (req: Request, res: Response) => {
  try {
    const logs = dbService.getJobLogs(req.params.id);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Configure Simulation Options
apiRouter.post('/jobs/:id/simulate', (req: Request, res: Response) => {
  try {
    setJobSimulation(req.params.id, req.body);
    res.json({ message: 'Simulation configured', simulation: getJobSimulation(req.params.id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Delete job
apiRouter.delete('/jobs/:id', (req: Request, res: Response) => {
  try {
    dbService.deleteJob(req.params.id);
    res.json({ message: 'Job deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Media Streaming with HTTP Range Support for smooth video playback
apiRouter.get('/media/:folder/:filename', (req: Request, res: Response) => {
  const { folder, filename } = req.params;
  const paths = dbService.getPaths();

  let targetDir = paths.outputsDir;
  if (folder === 'clips') targetDir = paths.clipsDir;
  else if (folder === 'audio') targetDir = paths.audioDir;
  else if (folder === 'outputs') targetDir = paths.outputsDir;

  const sanitizedFilename = path.basename(filename);
  const filePath = path.join(targetDir, sanitizedFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(sanitizedFilename).toLowerCase();
  const contentType = ext === '.mp4' ? 'video/mp4' : ext === '.wav' ? 'audio/wav' : 'application/octet-stream';

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// 13. ZeroGPU Python Export Downloads
apiRouter.get('/export/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  if (filename === 'app.py') {
    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', 'attachment; filename="app.py"');
    return res.send(getZeroGPUPythonAppCode());
  }
  if (filename === 'requirements.txt') {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="requirements.txt"');
    return res.send(getZeroGPURequirementsTxt());
  }
  if (filename === 'README.md') {
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="README.md"');
    return res.send(getZeroGPUReadme());
  }
  res.status(404).send('Unknown export file');
});
