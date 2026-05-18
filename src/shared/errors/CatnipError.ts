export class CatnipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatnipError";
  }
}
