import { CatnipError } from "./CatnipError.js";

export class ToolError extends CatnipError {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}
