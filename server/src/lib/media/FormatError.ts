export default class FormatError extends Error {
  readonly name: string = 'FormatError';
  constructor (message: string) {
    // https://stackoverflow.com/a/58417721
    super(message);
    this.name = 'FormatError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
