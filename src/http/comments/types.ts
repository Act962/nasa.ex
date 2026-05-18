export type CommentsConfig = {
  apiKey: string;
  secret: string;
  userId: string;
  baseUrl?: string;
  scopes?: string[];
  connectedAt?: string;
  consentByUserId?: string;
};

export class CommentsHttpError extends Error {
  status: number;
  code: string | null;
  bodySnippet: string | null;

  constructor(opts: {
    status: number;
    message: string;
    code?: string | null;
    bodySnippet?: string | null;
  }) {
    super(opts.message);
    this.name = "CommentsHttpError";
    this.status = opts.status;
    this.code = opts.code ?? null;
    this.bodySnippet = opts.bodySnippet ?? null;
  }

  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  isPreconditionError(): boolean {
    return this.status === 412 || this.status === 428;
  }
}
