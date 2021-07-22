/******************************************************************************
 ** Parser
 ******************************************************************************/

function isWhitespace(ch: string): boolean {
  switch(ch) {
    case ' ':
    case '　':
    case '\r':
    case '\n':
      return true;
    default:
      return false;
  }
}

function isNotWhitespace(ch: string): boolean {
  return !isWhitespace(ch);
}

 export class Buffer {
  private readonly buff: string;
  private pos: number;
  constructor(buff: string) {
    this.buff = buff;
    this.pos = 0;
  }
  look1(): string {
    return this.buff[this.pos];
  }
  take1(): string {
    const c = this.buff[this.pos];
    this.pos++;
    return c;
  }
  takeWhile(fn: (ch: string) => boolean): string {
    const beg = this.pos;
    while(this.hasNext() && fn(this.buff[this.pos])) {
      this.pos++;
    }
    return this.buff.slice(beg, this.pos);
  }
  expect(literal: string): string {
    const actual = this.buff.slice(this.pos, this.pos + literal.length);
    if(actual !== literal) {
      throw new ParseError(`Expected "${literal}", got "${actual}"`);
    }
    this.pos += literal.length;
    return literal;
  }
  skipWhile(fn: (ch: string) => boolean) {
    while(this.hasNext() && fn(this.buff[this.pos])) {
      this.pos++;
    }
  }
  skipWhitespace() {
    this.skipWhile(isWhitespace);
  }
  hasNext(): boolean {
    return this.pos < this.buff.length;
  }
  try<T>(fn: () => T): T {
    const orig = this.pos;
    try {
      return fn();
    } catch (e) {
      this.pos = orig;
      throw e;
    }
  }
}

export class ParseError extends Error {
  constructor(msg: string) {
    super(msg);
    // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

export class Parser{
  private readonly buff: Buffer;
  private blocks: Block[];
  constructor(buff: Buffer) {
    this.buff = buff;
    this.blocks = [];
  }
  parse(): Document {
    let texts: string[] = [];
    const commitText = () => {
      if(texts.length > 0) {
        this.blocks.push(makeText(texts.join('')));
        texts = [];
      }
    };
    while(this.buff.hasNext()) {
      switch(this.buff.look1()) {
      case '[':
        const block = this.try(() => this.parseBlock());
        if (block !== null){
          commitText();
          this.blocks.push(block);
        } else {
          texts.push(this.readText());
        }
        break;
      case '\n':
      case '\r':
        this.buff.takeWhile((ch) => ch == '\r' || ch == '\n');
        commitText();
        break;
      default:
        this.buff.skipWhitespace();
        texts.push(this.readText());
        break;
      }
    }
    commitText();
    return new Document(this.blocks);
  }
  private readText(): string {
    const first = this.buff.take1();
    const left = this.buff.takeWhile((ch) => !(ch === '\r' || ch === '\n' || ch === '['));
    return first + left;
  }
  private parseBlock(): Image | Video | Audio | Link | Markdown {
    const [tag, map] = this.parseBracket();
    switch(tag) {
      case 'image':
        return makeImage(map.get('entity'), map.get('link'));
      case 'video':
        return makeVideo(map.get('entity'));
      case 'audio':
        return makeAudio(map.get('entity'));
      case 'link':
        return makeLink(map.get('entity'), map.get('text'));
      case 'markdown':
        return makeMarkdown(map.get('url'));
      default:
        throw new ParseError(`Unknown block type: ${tag}`);
    }
  }
  private parseBracket(): [string, Map<string, string>] {
    const map = new Map<string, string>();
    this.buff.expect('[');
    const tag = this.buff.takeWhile(isNotWhitespace);
    this.buff.skipWhitespace();
    while(this.buff.hasNext() && this.buff.look1() !== ']') {
      const key = this.buff.takeWhile((ch) => isNotWhitespace(ch) && ch !== '=');
      this.buff.skipWhitespace();
      this.buff.expect('=');
      this.buff.skipWhitespace();
      this.buff.expect('"');
      const value = this.buff.takeWhile((ch) => ch !== '"');
      this.buff.expect('"');
      this.buff.skipWhitespace();
      map.set(key, value);
    }
    this.buff.expect(']');
    return [tag, map];
  }
  private try<T>(fn: () => T): T | null {
    try {
      return this.buff.try(fn);
    } catch (e) {
      if (e instanceof ParseError) {
        return null;
      } else {
        throw e;
      }
    }
  }
}

/******************************************************************************
 ** Document & AST
 ******************************************************************************/
export class Document {
  blocks: Block[];
  constructor(blocks: Block[]) {
    this.blocks = blocks;
  }
}

type Block = Text | Image | Video | Audio | Link | Markdown;

export type Text = {
  type: 'text';
  text: string;
}

export function makeText(str: string): Text {
  return {
    type: 'text',
    text: str,
  }
}

export type Image = {
  type: 'image';
  entity: string | undefined;
  link: string | undefined;
}

export function makeImage(entity: string | undefined, link?: string | undefined): Image {
  return {
    type: 'image',
    entity: entity,
    link: link,
  }
}

export type Video = {
  type: 'video';
  entity: string | undefined;
}

export function makeVideo(entity: string | undefined): Video {
  return {
    type: 'video',
    entity: entity,
  }
}

export type Audio = {
  type: 'audio';
  entity: string | undefined;
}

export function makeAudio(entity: string | undefined): Audio {
  return {
    type: 'audio',
    entity: entity,
  }
}

export type Link = {
  type: 'link';
  entity: string | undefined;
  text: string | undefined;
}

export function makeLink(entity: string | undefined, text: string | undefined): Link {
  return {
    type: 'link',
    entity: entity,
    text: text,
  }
}

export type Markdown = {
  type: 'markdown';
  url: string | undefined;
}

export function makeMarkdown(url: string | undefined): Markdown {
  return {
    type: 'markdown',
    url: url,
  }
}
