// Matriz 6.2 e invariante 6.3 da spec 0005 (bloqueio de edição por autoria).
import { describe, expect, it } from "vitest";
import {
  canEditFormResponse,
  resolveEditPolicy,
  type EditableResponse,
  type ResponseEditContext,
} from "./response-edit-policy";

const TRACKING = "tracking-vendas";
const AUTHOR = "user-autor";
const COLLEAGUE = "user-colega";

function context(overrides: Partial<ResponseEditContext> = {}): ResponseEditContext {
  return {
    userId: COLLEAGUE,
    isOrgMember: true,
    isMaster: false,
    ownedTrackingIds: new Set(),
    participantTrackingIds: new Set([TRACKING]),
    ...overrides,
  };
}

function response(overrides: Partial<EditableResponse> = {}): EditableResponse {
  return { authorKind: "USER", createdById: AUTHOR, leadTrackingId: TRACKING, ...overrides };
}

const allowed = { canEdit: true, reason: null };

describe("canEditFormResponse — quem não chega à política", () => {
  it("CB-8: quem não é membro da empresa não edita, em nenhuma política", () => {
    const outsider = context({ isOrgMember: false, isMaster: true });

    expect(canEditFormResponse(response(), "TRACKING_PARTICIPANTS", outsider)).toEqual({
      canEdit: false,
      reason: "not_org_member",
    });
  });

  it("CB-7: autor fora do tracking atual do lead é barrado pela regra de setor", () => {
    const authorOutside = context({ userId: AUTHOR, participantTrackingIds: new Set() });

    expect(canEditFormResponse(response(), "AUTHOR_ONLY", authorOutside)).toEqual({
      canEdit: false,
      reason: "not_tracking_participant",
    });
  });

  it("CB-9: resposta sem lead pula a regra de setor", () => {
    const noTracking = context({ participantTrackingIds: new Set() });

    expect(
      canEditFormResponse(response({ leadTrackingId: null }), "TRACKING_PARTICIPANTS", noTracking),
    ).toEqual(allowed);
  });
});

describe("canEditFormResponse — gestores (invariante 6.3)", () => {
  it("CB-6: Master edita mesmo sem participar do tracking, em AUTHOR_ONLY", () => {
    const master = context({ isMaster: true, participantTrackingIds: new Set() });

    expect(canEditFormResponse(response(), "AUTHOR_ONLY", master)).toEqual(allowed);
    expect(canEditFormResponse(response({ authorKind: "UNKNOWN" }), "AUTHOR_ONLY", master)).toEqual(allowed);
  });

  it("dono do tracking do lead edita resposta de outro autor em AUTHOR_ONLY", () => {
    const trackingOwner = context({ ownedTrackingIds: new Set([TRACKING]) });

    expect(canEditFormResponse(response(), "AUTHOR_ONLY", trackingOwner)).toEqual(allowed);
  });

  it("ser dono de outro tracking não dá passe", () => {
    const otherOwner = context({ ownedTrackingIds: new Set(["outro-tracking"]) });

    expect(canEditFormResponse(response(), "AUTHOR_ONLY", otherOwner)).toEqual({
      canEdit: false,
      reason: "not_author",
    });
  });
});

describe("canEditFormResponse — TRACKING_PARTICIPANTS", () => {
  it.each(["USER", "LEAD", "SYSTEM", "UNKNOWN"] as const)(
    "CB-4: participante edita resposta de origem %s",
    (authorKind) => {
      expect(canEditFormResponse(response({ authorKind }), "TRACKING_PARTICIPANTS", context())).toEqual(allowed);
    },
  );
});

describe("canEditFormResponse — AUTHOR_ONLY", () => {
  it("CB-10: o autor edita a própria resposta", () => {
    expect(canEditFormResponse(response(), "AUTHOR_ONLY", context({ userId: AUTHOR }))).toEqual(allowed);
  });

  it("colega participante não edita resposta de outro autor", () => {
    expect(canEditFormResponse(response(), "AUTHOR_ONLY", context())).toEqual({
      canEdit: false,
      reason: "not_author",
    });
  });

  it("CB-5: resposta de usuário cujo autor foi removido fica só para gestores", () => {
    expect(canEditFormResponse(response({ createdById: null }), "AUTHOR_ONLY", context())).toEqual({
      canEdit: false,
      reason: "not_author",
    });
  });

  it("CA-6 / CB-2: resposta preenchida pelo lead cai para participante", () => {
    expect(
      canEditFormResponse(response({ authorKind: "LEAD", createdById: null }), "AUTHOR_ONLY", context()),
    ).toEqual(allowed);
  });

  it("CB-18: resposta criada em branco por automação cai para participante", () => {
    expect(
      canEditFormResponse(response({ authorKind: "SYSTEM", createdById: null }), "AUTHOR_ONLY", context()),
    ).toEqual(allowed);
  });

  it("CB-3: resposta legada sem atribuição fica só para gestores", () => {
    expect(
      canEditFormResponse(response({ authorKind: "UNKNOWN", createdById: null }), "AUTHOR_ONLY", context()),
    ).toEqual({ canEdit: false, reason: "unattributed_response" });
  });
});

describe("resolveEditPolicy", () => {
  it("CB-1: formulário sem configuração usa a política padrão", () => {
    expect(resolveEditPolicy(null)).toBe("TRACKING_PARTICIPANTS");
    expect(resolveEditPolicy(undefined)).toBe("TRACKING_PARTICIPANTS");
  });

  it("devolve a política configurada", () => {
    expect(resolveEditPolicy({ responseEditPolicy: "AUTHOR_ONLY" })).toBe("AUTHOR_ONLY");
  });
});
