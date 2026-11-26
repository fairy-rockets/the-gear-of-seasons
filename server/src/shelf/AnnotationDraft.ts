import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';

import { Annotation, kAnnotationMethods, kAnnotationPalettes, kMaterialSuggestions } from '../lib/protocol.js';
import { Entity, ImageEntity, InternalVideoEntity } from './Entity.js';
import Shelf from './Shelf.js';

type VisualEntity = ImageEntity | InternalVideoEntity;
type Draft = Annotation.Draft.Values;
const kExecFile = promisify(execFile);
const kMaxFrames = 12;
const kTimeoutMs = 10 * 60_000;
const kRetentionMs = 15 * 60_000;
const kMaxJobs = 32;
const kVisualMethods = kAnnotationMethods.filter(m => m !== 'compose');
const kString = { type: 'string' };
const kStrings = { type: 'array', items: kString };
const kProperties = {
  subject: kString, alt: kString, description: kString, tags: kStrings,
  methods: { type: 'array', items: { type: 'string', enum: kVisualMethods } },
  materials: { type: 'array', items: { type: 'string', enum: kMaterialSuggestions } }, palette: { type: 'string', enum: kAnnotationPalettes },
  note: { type: ['string', 'null'] },
};
const kFormat = { type: 'object', properties: kProperties, required: Object.keys(kProperties), additionalProperties: false };

// ログに出してよい固定の診断（入力内容やファイル名を含めない）。
class DraftError extends Error {}

export function isDraftMedia(entity: Entity): entity is VisualEntity {
  return entity.location === 'internal' && entity.type !== 'audio';
}

function stringValue(v: unknown): string {
  if (typeof v !== 'string') throw new DraftError('文字列が必要です');
  return v.trim();
}

function stringList(v: unknown, splitItems = false): string[] {
  if (!Array.isArray(v)) throw new DraftError('文字列の配列が必要です');
  const values = v.map(stringValue);
  return [...new Set((splitItems ? values.flatMap(t => t.split(/[,\r\n]/).map(s => s.trim())) : values).filter(Boolean))];
}

export function parseDraft(text: string): Draft {
  const raw = JSON.parse(text);
  const selected = stringList(raw.methods);
  const methods = kVisualMethods.filter(m => selected.includes(m));
  const materials = stringList(raw.materials);
  if (methods.includes('draw') && materials.some(m => !kMaterialSuggestions.some(material => material === m))) {
    throw new DraftError('画材の選択値が不正です');
  }
  const subject = stringValue(raw.subject), alt = stringValue(raw.alt), description = stringValue(raw.description);
  const tags = stringList(raw.tags, true);
  if (!subject || !alt || !description || !tags.length) throw new DraftError('注釈の必須項目が空です');
  if (!methods.length || selected.some(m => !methods.some(method => method === m))
    || !kAnnotationPalettes.includes(raw.palette)) throw new DraftError('注釈の選択値が不正です');
  return {
    methods, materials: methods.includes('draw') && materials.length ? materials : null,
    subject, alt, description, tags, palette: raw.palette, note: raw.note === null ? null : stringValue(raw.note) || null,
  };
}

function prompt(req: Annotation.Draft.Request, entity: VisualEntity, frames: number): string {
  const drawing = req.kind === 'drawing';
  const moving = entity.type === 'video';
  const what = moving ? (drawing ? '手描きアニメーション' : '撮影動画') : (drawing ? '手描きの絵' : '写真');
  return [
    `添付の${what}のアクセシビリティ用の注釈を日本語で作成してください。`,
    moving && `長さ ${entity.duration} 秒の映像から採った ${frames} 枚のコマが時間順に並んでいます。時間による変化も説明してください。`,
    'alt は見えない読者向けに内容を1〜2文で、description は構図・色・細部を3〜5文で説明してください。',
    'subject は題名と作品を照合して主題を短い名詞句で、tags は題材を5〜10語で表してください。',
    'methods は draw（手描き）、capture（撮影）、render（3DCG）、generate（生成AI）から選んでください。',
    `materials は draw の場合の画材（例 ${kMaterialSuggestions.join('、')}）、それ以外は [] としてください。`,
    'palette は color または monochrome。note は作品で確認できる特徴や作者の補足から、別記する価値のある事実を短く書いてください。該当する事実がなければ null としてください。',
    `作品名: ${req.title.slice(0, 500)}`, `本文: ${req.body.slice(0, 3000)}`,
    !drawing && req.place && `撮影地: ${req.place.slice(0, 500)}`,
    req.note && `作者の補足: ${req.note.slice(0, 1000)}`,
  ].filter(Boolean).join('\n');
}

async function framesOf(file: string, entity: VisualEntity, signal: AbortSignal): Promise<string[]> {
  const options = { signal, encoding: 'buffer' as const, maxBuffer: 2 * 1024 * 1024, killSignal: 'SIGKILL' as const };
  if (entity.type === 'image') {
    const { stdout } = await kExecFile('magick', [`${file}[0]`, '-auto-orient', '-thumbnail', '768x768>',
      '-background', 'white', '-alpha', 'remove', '-strip', '-quality', '82', 'jpeg:-'], options);
    if (!stdout.length) throw new DraftError('画像を読み込めません');
    return [stdout.toString('base64')];
  }
  const duration = entity.duration;
  if (!Number.isFinite(duration) || duration <= 0) throw new DraftError('動画の長さが不明です');
  const count = Math.min(kMaxFrames, Math.ceil(duration * 4));
  const frames = [];
  for (let i = 0; i < count; i++) {
    const { stdout } = await kExecFile('ffmpeg', ['-nostdin', '-v', 'error', '-ss', String(duration * i / count),
      '-protocol_whitelist', 'file,pipe', '-i', file, '-map', '0:v:0', '-frames:v', '1', '-vf',
      "scale=w='min(768,iw)':h='min(768,ih)':force_original_aspect_ratio=decrease",
      '-f', 'image2pipe', '-c:v', 'mjpeg', 'pipe:1'], options);
    if (stdout.length) frames.push(stdout.toString('base64'));
  }
  if (!frames.length) throw new DraftError('動画のコマを読み込めません');
  return frames;
}

export async function generateDraft(shelf: Shelf, url: string, model: string, req: Annotation.Draft.Request,
                                    entity: VisualEntity, signal: AbortSignal): Promise<Draft> {
  const original = await shelf.resolveEntityPath(entity, 'original');
  if (!original) throw new DraftError('元ファイルがありません');
  const images = await framesOf(path.join(...original), entity, signal);
  const res = await fetch(new URL('/api/generate', url), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, redirect: 'error',
    body: JSON.stringify({ model, prompt: prompt(req, entity, images.length), images, stream: false,
      think: false, format: kFormat, options: { temperature: 0.2, num_predict: 2048 } }),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new DraftError(`Ollama HTTP ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new DraftError('Ollama の応答が空です');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 128 * 1024) {
      await reader.cancel();
      throw new DraftError('Ollama の応答が大きすぎます');
    }
    chunks.push(value);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return parseDraft(data.response);
}

export class DraftJobs {
  private busy = false;
  private readonly jobs = new Map<string, { status: Annotation.Draft.StatusResponse; expires: number }>();

  start(run: (signal: AbortSignal) => Promise<Draft>): string | null {
    if (this.busy) return null;
    const jobID = randomUUID();
    if (this.jobs.size >= kMaxJobs) this.jobs.delete(this.jobs.keys().next().value!);
    const job = { status: { status: 'pending' } as Annotation.Draft.StatusResponse, expires: Infinity };
    this.jobs.set(jobID, job);
    this.busy = true;
    const signal = AbortSignal.timeout(kTimeoutMs);
    void run(signal).then(draft => {
      job.status = { status: 'complete', draft };
    }).catch((err: unknown) => {
      // execFile の message / stderr と JSON のパースエラーには、ファイル名や生成内容が含まれる。
      const cause = err instanceof DraftError ? err.message : err instanceof Error ? err.name : 'Error';
      console.error(`annotation-draft ${jobID}: ${signal.aborted ? 'timeout' : cause}`);
      job.status = { status: 'failed', message: signal.aborted ? '下書きの生成がタイムアウトしました。' : '下書きを生成できませんでした。メディアと Ollama の設定を確認してください。' };
    }).finally(() => {
      job.expires = Date.now() + kRetentionMs;
      this.busy = false;
    });
    return jobID;
  }

  get(id: string): Annotation.Draft.StatusResponse | undefined {
    const job = this.jobs.get(id);
    if (job && job.expires <= Date.now()) {
      this.jobs.delete(id);
      return undefined;
    }
    return job?.status;
  }
}
