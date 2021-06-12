/******************************************************************************
 ** Parser
 ******************************************************************************/

 export class Buffer {
  private readonly buff: string;
  private pos: number;
  constructor(buff: string) {
    this.buff = buff;
    this.pos = 0;
  }
  look1(): string {
    return this.buff.charAt(this.pos);
  }
  take1(): string {
    const c = this.buff.charAt(this.pos);
    this.pos++;
    return c;
  }
  takeWhile(fn: (ch: string) => boolean): string {
    const beg = this.pos;
    while(this.pos < this.buff.length && fn(this.buff[this.pos])) {
      this.pos++;
    }
    return this.buff.slice(beg, this.pos);
  }
  hasNext(): boolean {
    return this.pos < this.buff.length;
  }
  try<T>(fn: () => T): T {
    const pos = this.pos;
    try {
      return fn();
    } catch (e) {
      this.pos = pos;
      throw e;
    }
  }
}

export class ParseError extends Error {
  constructor(msg: string) {
    super(msg);
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
    while(this.buff.hasNext()) {
      switch(this.buff.look1()) {
        case '[':
          let entity = this.try(() => {
          });
          if (entity !== null){

          } else {

          }
          break;
        default:
          this.blocks.push(this.parseText());
          break;
      }
    }
    return new Document(this.blocks);
  }
  parseText(): Text {
    const str = this.buff.takeWhile((ch) => ch !== '\n' && ch !== '[');
    return {
      type: "text",
      text: str,
    };
  }
  try<T>(fn: () => T): T | null {
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

type Block = Text | Image;

export type Text = {
  type: 'text';
  text: string;
}

export function text(str: string): Text {
  return {
    type: 'text',
    text: str,
  }
}

export type Image = {
  type: 'image';
  entity: string;
}

export function image(entity: string): Image {
  return {
    type: 'image',
    entity: entity,
  }
}
