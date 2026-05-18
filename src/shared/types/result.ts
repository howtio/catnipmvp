export interface LayerResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}
