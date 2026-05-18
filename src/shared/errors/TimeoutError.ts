import { CatnipError } from "./CatnipError.js";

export class TimeoutError extends CatnipError {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}
