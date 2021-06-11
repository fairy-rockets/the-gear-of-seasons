
export module FML {
  export class Parser{
    readonly buff: string;
    pos: number;
    constructor(buff: string) {
      this.buff = buff;
      this.pos = 0;
    }
  }
}
