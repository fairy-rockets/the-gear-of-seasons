import dayjs from 'dayjs';
import { FastifyReply, FastifyRequest } from 'fastify';

import * as protocol from '../../lib/protocol.js';
import { AnnotationField, AnnotationValues, kAnnotationFields } from '../../lib/protocol.js';

import Shelf from '../../shelf/Shelf.js';
import { parseMomentTime } from '../../shelf/Moment.js';
import { AnnotationValue, parseBoolean, parseString, parseStrings } from '../../shelf/CurationFormat.js';
import {
  parseAnnotationMedium,
  parseAnnotationPalette,
  parseAnnotationRole,
  parseLooksChild,
  parseLooksNude,
} from '../../shelf/EntityAnnotation.js';

// entity の id は元ファイルの md5（Storage）。
const kEntityID = /^[0-9a-f]{32}$/;
// 1度に読む entity の数の上限。1つの moment のメディアの数なら届かない。
const kMaxFindIDs = 256;

function nullable<T>(parse: (v: unknown) => T): (v: unknown) => T | null {
  return (v) => v === null ? null : parse(v);
}

// 項目ごとの値の形。Record にしてあるので、項目を足すと、ここに足すまでコンパイルが通らない。
const kParsers: Record<AnnotationField, (v: unknown) => AnnotationValue> = {
  medium: parseAnnotationMedium,
  alt: nullable(parseString),
  description: nullable(parseString),
  tags: nullable(parseStrings),
  palette: parseAnnotationPalette,
  characters: nullable(parseStrings),
  looksNude: parseLooksNude,
  looksChild: parseLooksChild,
  looksNote: nullable(parseString),
  humanVerified: parseBoolean,
  role: parseAnnotationRole,
  roleGroup: nullable(parseString),
  roleStar: nullable(parseBoolean),
  roleNote: nullable(parseString),
};

// POST /annotation の annotation。すべての項目が要り、定義に無い項目は通さない。
// 欠けた項目を null に読み替えると、古いクライアントからの保存で値が黙って消えるため。
// その種類が持たない項目かどうかは、保存するときに validateEntityAnnotation が確かめる。
export function parseAnnotationValues(v: unknown): AnnotationValues {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Error(`annotation がオブジェクトではありません: ${JSON.stringify(v)}`);
  }
  const raw = v as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!(kAnnotationFields as readonly string[]).includes(key)) {
      throw new Error(`annotation に無い項目です: ${key}`);
    }
  }
  const values = {} as Record<AnnotationField, AnnotationValue>;
  for (const key of kAnnotationFields) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) {
      throw new Error(`annotation に ${key} がありません`);
    }
    try {
      values[key] = kParsers[key](raw[key]);
    } catch (err) {
      throw new Error(`annotation の ${key}: ${(err as Error).message}`);
    }
  }
  return values as AnnotationValues;
}

function emptyAnnotationValues(): AnnotationValues {
  return {
    medium: null, alt: null, description: null, tags: null, palette: null, characters: null,
    looksNude: null, looksChild: null, looksNote: null, humanVerified: false,
    role: null, roleGroup: null, roleStar: null, roleNote: null,
  };
}

function badRequest(reply: FastifyReply, message: string): FastifyReply {
  return reply
    .type('application/json;charset=UTF-8')
    .code(400)
    .send({ statusCode: 400, error: 'Bad Request', message });
}

// ura の編集画面の、注釈の引き出しが使う口。
export default class AnnotationController {
  private readonly shelf: Shelf;
  constructor(shelf: Shelf) {
    this.shelf = shelf;
  }
  static async create(shelf: Shelf): Promise<AnnotationController> {
    return new AnnotationController(shelf);
  }

  // GET /annotations?ids=<id>,<id>,…
  async handleFind(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const query = (req.query ?? {}) as Record<string, unknown>;
    if (typeof query['ids'] !== 'string') {
      return badRequest(reply, 'ids をカンマ区切りの1つの文字列で渡してください');
    }
    const ids = [...new Set(query['ids'].split(',').filter((id) => id.length > 0))];
    if (ids.length > kMaxFindIDs) {
      return badRequest(reply, `ids は ${kMaxFindIDs} 個までです`);
    }
    for (const id of ids) {
      if (!kEntityID.test(id)) {
        return badRequest(reply, `entity の id ではありません: ${id}`);
      }
    }
    const entities: protocol.Annotation.Find.Response['entities'] = [];
    for (const id of ids) {
      const entity = await this.shelf.findEntity(id);
      if (entity === null) {
        continue;
      }
      entities.push({ entityID: entity.id, type: entity.type, annotation: emptyAnnotationValues() });
    }
    const annotations = await this.shelf.findEntityAnnotations(entities.map((e) => e.entityID));
    for (const e of entities) {
      const found = annotations.get(e.entityID);
      if (found !== undefined) {
        const { entityID: _, ...values } = found;
        e.annotation = values;
      }
    }
    const resp: protocol.Annotation.Find.Response = { entities };
    return reply
      .type('application/json;charset=UTF-8')
      .code(200)
      .send(resp);
  }

  // POST /annotation。1つの entity の注釈を保存する。その entity を本文に含む moment の sensitive は、
  // Shelf.saveEntityAnnotation が同じトランザクションで計算し直す。
  async handleSave(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const raw = req.body as Record<string, unknown> | null;
    if (typeof raw !== 'object' || raw === null) {
      return badRequest(reply, '本文がありません');
    }
    const entityID = raw['entityID'];
    if (typeof entityID !== 'string' || !kEntityID.test(entityID)) {
      return badRequest(reply, `entity の id ではありません: ${JSON.stringify(entityID)}`);
    }
    let timestamp: dayjs.Dayjs | null = null;
    const originalDate = raw['originalDate'];
    if (originalDate !== undefined && originalDate !== null) {
      timestamp = typeof originalDate === 'string' ? parseMomentTime(originalDate) : null;
      if (timestamp === null || !timestamp.isValid()) {
        return badRequest(reply, `originalDate が日時ではありません: ${JSON.stringify(originalDate)}`);
      }
    }
    let values: AnnotationValues;
    try {
      values = parseAnnotationValues(raw['annotation']);
    } catch (err) {
      return badRequest(reply, (err as Error).message);
    }
    await this.shelf.saveEntityAnnotation({ entityID, ...values });
    const resp: protocol.Annotation.Save.Response = {};
    if (timestamp !== null) {
      const moment = await this.shelf.findMoment(timestamp, 'all');
      if (moment !== null) {
        resp.moment = { sensitive: moment.sensitive, sensitiveManual: moment.sensitiveManual };
      }
    }
    return reply
      .type('application/json;charset=UTF-8')
      .code(200)
      .send(resp);
  }
}
