import fs from 'node:fs';
import path from 'node:path';

interface ServerConfig {
  hf_token?: string;
  hf_space?: string;
  default_engine?: 'ltx' | 'wan' | 'auto';
  last_updated?: string;
}

const CONFIG_FILE = path.resolve(process.cwd(), 'storage', 'server_config.json');

export function getServerConfig(): ServerConfig {
  let stored: ServerConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      stored = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[ServerConfig] Could not read server_config.json:', err);
  }

  // Environment variables take precedence or fallback
  const hf_token = stored.hf_token || process.env.HF_TOKEN || '';
  const hf_space = stored.hf_space || process.env.HF_SPACE || 'Lightricks/ltx-video-distilled';
  const default_engine = stored.default_engine || 'auto';

  return {
    hf_token,
    hf_space,
    default_engine,
    last_updated: stored.last_updated,
  };
}

export function updateServerConfig(newConfig: Partial<ServerConfig>): ServerConfig {
  const current = getServerConfig();
  const updated: ServerConfig = {
    ...current,
    ...newConfig,
    last_updated: new Date().toISOString(),
  };

  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ServerConfig] Could not save server_config.json:', err);
  }

  return updated;
}

export function getHfToken(): string | undefined {
  const cfg = getServerConfig();
  return cfg.hf_token?.trim() || undefined;
}
