import { CatnipError } from "./CatnipError.js";

export class PolicyError extends CatnipError {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}
