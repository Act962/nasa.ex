import { describe, expect, it } from "vitest";
import {
  PAYMENT_ACTIONS,
  PAYMENT_RESOURCES,
  resolveEffectivePermissions,
  ROLE_DEFAULTS,
} from "./permissions";

const resourcesExceptSettings = PAYMENT_RESOURCES.filter((resource) => resource !== "settings");

describe("ROLE_DEFAULTS", () => {
  it("VIEWER só visualiza, em todos os recursos", () => {
    for (const resource of PAYMENT_RESOURCES) {
      expect(ROLE_DEFAULTS.VIEWER[resource]).toEqual({
        view: true,
        create: false,
        edit: false,
        delete: false,
      });
    }
  });

  it("EDITOR cria e edita, mas não exclui", () => {
    for (const resource of resourcesExceptSettings) {
      expect(ROLE_DEFAULTS.EDITOR[resource]).toEqual({
        view: true,
        create: true,
        edit: true,
        delete: false,
      });
    }
  });

  it("ADMIN faz tudo fora das configurações", () => {
    for (const resource of resourcesExceptSettings) {
      expect(ROLE_DEFAULTS.ADMIN[resource]).toEqual({
        view: true,
        create: true,
        edit: true,
        delete: true,
      });
    }
  });

  it.each(["EDITOR", "ADMIN"] as const)("%s só visualiza as configurações", (role) => {
    expect(ROLE_DEFAULTS[role].settings).toEqual({
      view: true,
      create: false,
      edit: false,
      delete: false,
    });
  });

  it("OWNER faz tudo, inclusive nas configurações", () => {
    for (const resource of PAYMENT_RESOURCES) {
      for (const action of PAYMENT_ACTIONS) {
        expect(ROLE_DEFAULTS.OWNER[resource][action]).toBe(true);
      }
    }
  });
});

describe("resolveEffectivePermissions", () => {
  it.each([null, undefined, "texto", 0])("sem override válido (%j) devolve o padrão do papel", (override) => {
    expect(resolveEffectivePermissions("EDITOR", override)).toBe(ROLE_DEFAULTS.EDITOR);
  });

  it("override parcial concede uma ação e mantém o resto do padrão", () => {
    const effective = resolveEffectivePermissions("EDITOR", { entries: { delete: true } });

    expect(effective.entries).toEqual({ view: true, create: true, edit: true, delete: true });
    expect(effective.accounts).toEqual(ROLE_DEFAULTS.EDITOR.accounts);
    expect(effective.settings).toEqual(ROLE_DEFAULTS.EDITOR.settings);
  });

  it("override também retira permissão do papel", () => {
    const effective = resolveEffectivePermissions("OWNER", { settings: { edit: false } });

    expect(effective.settings).toEqual({ view: true, create: true, edit: false, delete: true });
  });

  it("ignora valor que não é booleano, recurso e ação desconhecidos", () => {
    const effective = resolveEffectivePermissions("VIEWER", {
      entries: { create: "true", edit: 1, aprovar: true },
      relatorios: { view: true },
      accounts: "tudo",
    });

    expect(effective).toEqual(ROLE_DEFAULTS.VIEWER);
    expect(Object.keys(effective)).toEqual([...PAYMENT_RESOURCES]);
    expect(Object.keys(effective.entries)).toEqual([...PAYMENT_ACTIONS]);
  });

  it("não altera a matriz padrão do papel", () => {
    resolveEffectivePermissions("VIEWER", { entries: { delete: true } });

    expect(ROLE_DEFAULTS.VIEWER.entries.delete).toBe(false);
  });
});
